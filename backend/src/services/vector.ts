import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { env, features } from "../lib/env";
import type { Chunk } from "./rag/chunking";

/**
 * Vector store (Pinecone) + embeddings (OpenAI).
 *
 * - One index, one namespace per workspace (namespace = workspaceId) → hard tenant isolation.
 * - Vector ids: `${documentId}:v${version}:${chunkIndex}`. New versions are upserted first and old ones deleted
 *   after, so a re-index never leaves the knowledge base empty (zero-downtime swap).
 * - Embedded text carries a contextual header (document + section) — improves recall for short chunks.
 */
const DIMENSION = 1536;

let openai: OpenAI | null = null;
export function getOpenAI() {
  if (!features.openai()) throw new Error("OPENAI_API_KEY is not configured");
  openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 4, timeout: 30_000 });
  return openai;
}

let pinecone: Pinecone | null = null;
let indexReady: Promise<void> | null = null;

export function pc() {
  if (!features.pinecone()) throw new Error("PINECONE_API_KEY is not configured");
  pinecone ??= new Pinecone({ apiKey: env.PINECONE_API_KEY });
  return pinecone;
}

async function ensureIndex() {
  indexReady ??= (async () => {
    const client = pc();
    const { indexes = [] } = await client.listIndexes();
    if (indexes.some((i) => i.name === env.PINECONE_INDEX)) return;
    await client.createIndex({
      name: env.PINECONE_INDEX,
      dimension: DIMENSION,
      metric: "cosine",
      spec: { serverless: { cloud: env.PINECONE_CLOUD as "aws", region: env.PINECONE_REGION } },
      waitUntilReady: true,
      suppressConflicts: true,
    } as any);
  })().catch((e) => {
    indexReady = null;
    throw e;
  });
  return indexReady;
}

async function ns(workspaceId: string) {
  await ensureIndex();
  return pc().index<ChunkMetadata>({ name: env.PINECONE_INDEX, namespace: workspaceId });
}

// ── Embeddings ──

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96).map((t) => t.slice(0, 24_000)); // stay under the 8k-token input limit
    const res = await getOpenAI().embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: batch });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

/** Small LRU for query embeddings — repeated/similar customer questions are common. */
const queryCache = new Map<string, { v: number[]; at: number }>();
export async function embedQuery(text: string) {
  const key = text.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) {
    queryCache.delete(key);
    queryCache.set(key, hit);
    return hit.v;
  }
  const [v] = await embed([text]);
  queryCache.set(key, { v: v!, at: Date.now() });
  if (queryCache.size > 1000) queryCache.delete(queryCache.keys().next().value!);
  return v!;
}

// ── Indexing ──

export type ChunkMetadata = {
  documentId: string;
  documentName: string;
  version: number;
  chunkIndex: number;
  section: string;
  text: string;
  hash: string;
};

export const embeddingText = (documentName: string, c: Pick<Chunk, "section" | "text">) =>
  `Document: ${documentName}${c.section ? `\nSection: ${c.section}` : ""}\n\n${c.text}`;

export async function upsertChunks(workspaceId: string, documentId: string, documentName: string, version: number, chunks: Chunk[]) {
  const vectors = await embed(chunks.map((c) => embeddingText(documentName, c)));
  const index = await ns(workspaceId);
  const records = chunks.map((c, i) => ({
    id: `${documentId}:v${version}:${i}`,
    values: vectors[i]!,
    metadata: { documentId, documentName, version, chunkIndex: i, section: c.section, text: c.text, hash: c.hash } satisfies ChunkMetadata,
  }));
  for (let i = 0; i < records.length; i += 100) {
    await index.upsert({ records: records.slice(i, i + 100) });
  }
}

/** Delete a document's vectors (all versions, or all but `keepVersion`). Also cleans up legacy `${id}#n` ids. */
export async function deleteDocumentVectors(workspaceId: string, documentId: string, opts: { keepVersion?: number; legacyChunkCount?: number } = {}) {
  if (!features.pinecone()) return;
  const index = await ns(workspaceId);
  const keep = opts.keepVersion !== undefined ? `${documentId}:v${opts.keepVersion}:` : null;
  const ids: string[] = [];
  let token: string | undefined;
  do {
    const page = await index.listPaginated({ prefix: `${documentId}:`, limit: 100, paginationToken: token });
    for (const v of page.vectors ?? []) if (v.id && !(keep && v.id.startsWith(keep))) ids.push(v.id);
    token = page.pagination?.next;
  } while (token);
  for (let i = 0; i < (opts.legacyChunkCount ?? 0); i++) ids.push(`${documentId}#${i}`);
  for (let i = 0; i < ids.length; i += 1000) {
    await index.deleteMany({ ids: ids.slice(i, i + 1000) });
  }
}

// ── Querying ──

export type VectorMatch = ChunkMetadata & { id: string; vectorScore: number };

export async function queryVectors(workspaceId: string, vector: number[], topK: number): Promise<VectorMatch[]> {
  const index = await ns(workspaceId);
  const res = await index.query({ vector, topK, includeMetadata: true });
  return (res.matches ?? [])
    .filter((m) => m.metadata?.text)
    .map((m) => ({
      ...(m.metadata as ChunkMetadata),
      section: m.metadata?.section ?? "",
      version: m.metadata?.version ?? 1,
      hash: m.metadata?.hash ?? m.id,
      id: m.id,
      vectorScore: m.score ?? 0,
    }));
}

/** Cross-encoder rerank via Pinecone Inference. Returns null on failure so callers fall back to vector scores. */
export async function rerank(query: string, docs: string[], topN: number) {
  if (docs.length === 0) return [];
  try {
    const res = await pc().inference.rerank({
      model: env.RAG_RERANK_MODEL,
      query,
      documents: docs.map((text) => ({ text: text.slice(0, 4000) })),
      topN: Math.min(topN, docs.length),
      returnDocuments: false,
      parameters: { truncate: "END" },
    });
    return res.data.map((d) => ({ index: d.index, score: d.score }));
  } catch (e) {
    console.warn("[rerank] falling back to vector scores:", e instanceof Error ? e.message : e);
    return null;
  }
}
