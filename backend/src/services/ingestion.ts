import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { prisma } from "../lib/db";
import { storage } from "../lib/storage";
import { deleteDocumentVectors, upsertChunks } from "./vector";
import { chunkText } from "./rag/chunking";
import { realtime } from "./realtime";

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm"];

async function extractText(buffer: Buffer, name: string, mimeType: string): Promise<string> {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  if (ext === ".pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (ext === ".docx" || mimeType.includes("wordprocessingml")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  const raw = buffer.toString("utf8");
  if (ext === ".html" || ext === ".htm" || mimeType === "text/html") {
    return raw
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  }
  return raw;
}

export { chunkText } from "./rag/chunking";

async function setStatus(id: string, workspaceId: string, data: Parameters<typeof prisma.document.update>[0]["data"]) {
  const doc = await prisma.document.update({ where: { id }, data });
  realtime.toWorkspace(workspaceId, "document:updated", doc);
  return doc;
}

/**
 * Download → extract → structure-aware chunk → embed (with contextual header) → upsert new version
 * → delete previous versions. Upsert-then-delete means the AI keeps answering from the old version
 * until the new one is fully indexed; a failed run leaves the old version intact.
 */
export async function ingestDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  await setStatus(doc.id, doc.workspaceId, { status: "PROCESSING", error: null });
  try {
    const buffer = await storage.get(doc.storageKey);
    const text = await extractText(buffer, doc.name, doc.mimeType);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No readable text found in document");

    await upsertChunks(doc.workspaceId, doc.id, doc.name, doc.version, chunks);
    await deleteDocumentVectors(doc.workspaceId, doc.id, { keepVersion: doc.version, legacyChunkCount: doc.chunkCount });
    await setStatus(doc.id, doc.workspaceId, {
      status: "READY",
      chunkCount: chunks.length,
      indexedAt: new Date(),
    });
    return { chunks: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(doc.id, doc.workspaceId, { status: "FAILED", error: message.slice(0, 500) });
    throw err;
  }
}

export async function removeDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  await deleteDocumentVectors(doc.workspaceId, doc.id, { legacyChunkCount: doc.chunkCount }).catch((e) => console.error("pinecone delete", e));
  await storage.delete(doc.storageKey).catch((e) => console.error("storage delete", e));
  await prisma.document.delete({ where: { id: doc.id } });
}
