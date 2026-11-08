import { startActiveObservation } from "@langfuse/tracing";
import { features } from "../lib/env";
import { getOpenAI } from "./vector";
import type { RetrievedChunk } from "./rag/retrieval";

/**
 * Guardrails around the agent. Deterministic checks first (cheap, explainable), then OpenAI moderation
 * (free endpoint). Moderation fails OPEN with a warning: a moderation outage shouldn't take support down.
 *
 * INPUT  (customer message → before the model sees it)
 *   - size cap                       → truncate
 *   - payment-card / Aadhaar / PAN    → redact from model input, remind customer not to share
 *   - prompt-injection / jailbreak    → refuse politely, AI stays on
 *   - moderation: self-harm           → safe-messaging reply + escalate
 *   - moderation: harassment/violence → neutral reply + escalate
 *
 * OUTPUT (model reply → before the customer sees it)
 *   - leaked internals (system prompt, tool names, context tags)  → block
 *   - PII not belonging to this customer/business                  → block
 *   - links to domains not in the website/sources/conversation     → block (hallucinated URLs)
 *   - moderation                                                   → block
 *   - citations not in retrieved set                               → dropped
 *   - ungrounded: question needed docs but nothing was retrieved   → confidence capped → human review
 */

export type GuardAction = "allow" | "refuse" | "escalate";

export type InputGuardResult = {
  action: GuardAction;
  /** Text to send to the model (redacted/truncated). */
  sanitized: string;
  /** Customer-facing reply when action !== "allow". */
  reply?: string;
  reasons: string[];
  /** Extra system note for the model when allowed (e.g. "card number was redacted"). */
  note?: string;
};

export type OutputGuardResult = {
  action: "allow" | "block";
  reply: string;
  reasons: string[];
  citations: string[];
  confidenceCap?: number;
};

const MAX_INPUT_CHARS = 4000;

const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|all|your|system)\b.{0,30}\b(instructions?|prompts?|rules?|guidelines?)\b/i,
  /\b(reveal|show|print|repeat|output|leak)\b.{0,40}\b(system|hidden|initial|developer)\s*(prompt|instructions?|message)\b/i,
  /\byou are now\b.{0,40}\b(dan|unfiltered|jailbroken|developer mode|no restrictions)\b/i,
  /\b(developer|god|admin|sudo|debug)\s*mode\b.{0,30}\b(on|enabled?|activate)/i,
  /\bpretend\b.{0,40}\b(no|without)\b.{0,20}\b(rules|restrictions|guidelines|filters)\b/i,
  /<\/?(system|knowledge|source|instructions?)>/i,
  /\bBEGIN (SYSTEM|ADMIN) (PROMPT|MESSAGE)\b/i,
];

const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;
const AADHAAR_RE = /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>()"']+|\bwww\.[^\s<>()"']+/gi;

function luhn(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

async function moderate(text: string): Promise<{ flagged: boolean; categories: string[] }> {
  if (!features.openai() || !text.trim()) return { flagged: false, categories: [] };
  try {
    const res = await getOpenAI().moderations.create({ model: "omni-moderation-latest", input: text.slice(0, 8000) });
    const r = res.results[0];
    if (!r?.flagged) return { flagged: false, categories: [] };
    return { flagged: true, categories: Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k) };
  } catch (e) {
    console.warn("[guardrails] moderation unavailable, failing open:", e instanceof Error ? e.message : e);
    return { flagged: false, categories: [] };
  }
}

export function checkInput(text: string, ctx: { businessName: string }): Promise<InputGuardResult> {
  return startActiveObservation(
    "guardrail.input",
    async (obs) => {
      const reasons: string[] = [];
      let sanitized = text;
      let note: string | undefined;

      if (sanitized.length > MAX_INPUT_CHARS) {
        sanitized = sanitized.slice(0, MAX_INPUT_CHARS);
        reasons.push("truncated");
      }

      let redacted = false;
      sanitized = sanitized.replace(CARD_RE, (m) => (luhn(m) ? ((redacted = true), "[REDACTED_CARD_NUMBER]") : m));
      sanitized = sanitized.replace(AADHAAR_RE, () => ((redacted = true), "[REDACTED_ID_NUMBER]"));
      sanitized = sanitized.replace(PAN_RE, () => ((redacted = true), "[REDACTED_ID_NUMBER]"));
      if (redacted) {
        reasons.push("pii_redacted");
        note =
          "The customer's last message contained a card or government ID number which was redacted. Briefly remind them never to share full card or ID numbers in chat.";
      }

      const injection = INJECTION_PATTERNS.some((re) => re.test(text));
      const mod = await moderate(sanitized);

      let result: InputGuardResult;
      if (mod.flagged && mod.categories.some((c) => c.startsWith("self-harm"))) {
        result = {
          action: "escalate",
          sanitized,
          reasons: [...reasons, `moderation:${mod.categories.join(",")}`],
          reply:
            "I'm really sorry you're going through this. You don't have to face it alone. If you're in immediate danger, please contact your local emergency number. In India you can call the Tele-MANAS helpline at 14416. I'm bringing in a member of our team now.",
        };
      } else if (mod.flagged) {
        result = {
          action: "escalate",
          sanitized,
          reasons: [...reasons, `moderation:${mod.categories.join(",")}`],
          reply: "I want to make sure you get the right help, so I'm passing this conversation to a member of our team.",
        };
      } else if (injection) {
        result = {
          action: "refuse",
          sanitized,
          reasons: [...reasons, "prompt_injection"],
          reply: `I can only help with questions about ${ctx.businessName}. What can I help you with today?`,
        };
      } else {
        result = { action: "allow", sanitized, reasons, note };
      }
      obs.update({ input: text, output: { action: result.action, reasons: result.reasons }, level: result.action === "allow" ? "DEFAULT" : "WARNING" });
      return result;
    },
    { asType: "guardrail" },
  );
}

const INTERNAL_MARKERS = [
  /<\/?(knowledge|source)\b/i,
  /\b(search_knowledge_base|create_support_ticket|escalate_to_human|search_crm)\b/,
  /\bconfidence\s*(score)?\s*[:=]\s*0?\.\d/i,
  /\b(system prompt|my instructions (say|are)|I was instructed to)\b/i,
];

const hostOf = (u: string) => {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

export function checkOutput(
  reply: string,
  ctx: {
    citations: string[];
    chunks: RetrievedChunk[];
    needsRetrieval: boolean;
    needsHuman: boolean;
    website?: string | null;
    supportEmail?: string | null;
    customerEmail?: string | null;
    conversationText: string;
    channel: string;
  },
): Promise<OutputGuardResult> {
  return startActiveObservation(
    "guardrail.output",
    async (obs) => {
      const reasons: string[] = [];
      let text = reply.trim();

      // Strip inline citation markers — sources are shown to agents in the inbox, not to customers.
      text = text.replace(/\s*\[(S\d+(?:\s*,\s*S\d+)*)\]/g, "").trim();
      const validRefs = new Set(ctx.chunks.map((c) => c.ref));
      const citations = [...new Set(ctx.citations)].filter((c) => validRefs.has(c));
      if (citations.length !== ctx.citations.length) reasons.push("invalid_citations_dropped");

      const allowedText = `${ctx.chunks.map((c) => c.text).join("\n")}\n${ctx.conversationText}`;

      // Internals
      if (INTERNAL_MARKERS.some((re) => re.test(text))) reasons.push("block:internal_leak");

      // PII
      if ((text.match(CARD_RE) ?? []).some((m) => luhn(m)) || (text.match(PAN_RE) ?? []).length > 0) reasons.push("block:pii");
      const allowedEmails = new Set(
        [ctx.supportEmail, ctx.customerEmail, ...(allowedText.match(EMAIL_RE) ?? [])].filter(Boolean).map((e) => e!.toLowerCase()),
      );
      if ((text.match(EMAIL_RE) ?? []).some((e) => !allowedEmails.has(e.toLowerCase()))) reasons.push("block:unknown_email");

      // Links must come from somewhere real.
      const allowedHosts = new Set([ctx.website ? hostOf(ctx.website) : "", ...(allowedText.match(URL_RE) ?? []).map(hostOf)].filter(Boolean));
      const badLinks = (text.match(URL_RE) ?? []).filter((u) => {
        const h = hostOf(u);
        return h && ![...allowedHosts].some((a) => h === a || h.endsWith(`.${a}`));
      });
      if (badLinks.length) reasons.push(`block:unverified_link:${badLinks.slice(0, 3).join(" ")}`);

      // Moderation (only if nothing else already blocked — saves a call).
      if (!reasons.some((r) => r.startsWith("block:"))) {
        const mod = await moderate(text);
        if (mod.flagged) reasons.push(`block:moderation:${mod.categories.join(",")}`);
      }

      let confidenceCap: number | undefined;
      if (ctx.needsRetrieval && ctx.chunks.length === 0 && !ctx.needsHuman) {
        reasons.push("ungrounded:no_sources");
        confidenceCap = 0.4;
      } else if (ctx.needsRetrieval && ctx.chunks.length > 0 && citations.length === 0 && !ctx.needsHuman) {
        reasons.push("ungrounded:no_citations");
        confidenceCap = 0.5;
      }

      const blocked = reasons.some((r) => r.startsWith("block:"));
      const result: OutputGuardResult = blocked
        ? { action: "block", reply: "Let me get a teammate to confirm this for you. They'll reply here shortly.", reasons, citations, confidenceCap: 0 }
        : { action: "allow", reply: text, reasons, citations, confidenceCap };
      obs.update({ input: reply, output: { action: result.action, reasons }, level: blocked ? "WARNING" : "DEFAULT" });
      return result;
    },
    { asType: "guardrail" },
  );
}
