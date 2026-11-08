import crypto from "node:crypto";

/**
 * Structure-aware chunker.
 *
 * 1. Normalise text (whitespace, hyphenated line breaks from PDFs, repeated page headers/footers).
 * 2. Split into blocks and track the current section heading (markdown `#`, numbered "1.2 Title", or short
 *    Title/UPPER-case lines) so every chunk knows where it came from.
 * 3. Pack blocks into ~TARGET token chunks; oversize blocks are split on sentence boundaries.
 * 4. Overlap = the last sentences of the previous chunk (not a blind character slice).
 * 5. Drop tiny/duplicate chunks (content hash).
 */

export type Chunk = { text: string; section: string; hash: string; tokens: number };

const TARGET_TOKENS = 450;
const MAX_TOKENS = 600;
const OVERLAP_TOKENS = 60;
const MIN_CHARS = 40;

/** ~4 chars per token for English; good enough for budgeting without a tokenizer dependency. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export function normalise(raw: string) {
  let text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2") // de-hyphenate PDF line wraps
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");

  // Lines repeated on many "pages" (headers/footers, page numbers) add noise to every chunk.
  const lines = text.split("\n");
  const freq = new Map<string, number>();
  for (const l of lines) if (l.length > 0 && l.length < 80) freq.set(l, (freq.get(l) ?? 0) + 1);
  const pageish = Math.max(4, Math.floor(lines.length / 60));
  text = lines.filter((l) => !(freq.get(l)! >= pageish && l.length < 80) && !/^(page )?\d{1,4}( of \d{1,4})?$/i.test(l)).join("\n");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function headingOf(block: string): string | null {
  const first = block.split("\n")[0]!.trim();
  const md = first.match(/^#{1,6}\s+(.+)$/);
  if (md) return md[1]!.trim();
  if (block.includes("\n") || first.length > 90 || /[.!?,;:]$/.test(first)) return null;
  if (/^\d+(\.\d+)*\.?\s+\S/.test(first)) return first; // "2.3 Refund policy"
  const words = first.split(/\s+/);
  if (words.length <= 10 && (first === first.toUpperCase() && /[A-Z]/.test(first))) return first;
  if (words.length <= 8 && words.filter((w) => /^[A-Z]/.test(w)).length >= Math.ceil(words.length * 0.6)) return first;
  return null;
}

const sentences = (s: string) => s.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g)?.map((x) => x.trim()).filter(Boolean) ?? [s];

function tail(text: string, tokens: number) {
  const out: string[] = [];
  let n = 0;
  for (const s of sentences(text).reverse()) {
    if (n + estimateTokens(s) > tokens) break;
    out.unshift(s);
    n += estimateTokens(s);
  }
  return out.join(" ");
}

export function chunkText(raw: string): Chunk[] {
  const text = normalise(raw);
  if (!text) return [];

  const blocks: { text: string; section: string }[] = [];
  let section = "";
  for (const b of text.split(/\n\n+/)) {
    const h = headingOf(b);
    if (h) {
      section = h;
      const rest = b.split("\n").slice(1).join("\n").trim();
      if (rest) blocks.push({ text: rest, section });
      continue;
    }
    // Split oversize blocks on sentences.
    if (estimateTokens(b) > MAX_TOKENS) {
      let cur = "";
      for (const s of sentences(b)) {
        if (estimateTokens(cur + " " + s) > TARGET_TOKENS && cur) {
          blocks.push({ text: cur, section });
          cur = "";
        }
        // A single giant "sentence" (tables, minified text): hard split.
        if (estimateTokens(s) > MAX_TOKENS) {
          for (let i = 0; i < s.length; i += TARGET_TOKENS * 4) blocks.push({ text: s.slice(i, i + TARGET_TOKENS * 4), section });
          continue;
        }
        cur = cur ? `${cur} ${s}` : s;
      }
      if (cur) blocks.push({ text: cur, section });
    } else {
      blocks.push({ text: b, section });
    }
  }

  const chunks: Chunk[] = [];
  const seen = new Set<string>();
  let cur = "";
  let curSection = "";
  const flush = () => {
    const t = cur.trim();
    if (t.length >= MIN_CHARS) {
      const hash = crypto.createHash("sha1").update(t.toLowerCase()).digest("hex").slice(0, 16);
      if (!seen.has(hash)) {
        seen.add(hash);
        chunks.push({ text: t, section: curSection, hash, tokens: estimateTokens(t) });
      }
    }
  };

  for (const b of blocks) {
    // Tiny sections (a heading + one line) are merged with the next one instead of becoming weak, context-free chunks.
    const sectionChanged = b.section !== curSection && estimateTokens(cur) >= 120;
    if (cur && (sectionChanged || estimateTokens(cur) + estimateTokens(b.text) > TARGET_TOKENS)) {
      flush();
      // Carry overlap only within the same section — crossing sections mixes unrelated content.
      cur = sectionChanged ? "" : tail(cur, OVERLAP_TOKENS);
    }
    if (cur && b.section && b.section !== curSection) {
      // Merging a small section into the current chunk: keep its heading inline and label both.
      curSection = curSection ? `${curSection} / ${b.section}` : b.section;
      cur = `${cur}\n\n${b.section}\n${b.text}`;
    } else {
      curSection = b.section;
      cur = cur ? `${cur}\n\n${b.text}` : b.text;
    }
  }
  flush();
  return chunks;
}
