import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { prisma } from "../lib/db";
import { badRequest, notFound, param } from "../lib/http";
import { storage } from "../lib/storage";
import { features } from "../lib/env";
import { ADMIN, ctx, requireRole } from "../middleware/auth";
import { jobs } from "../services/jobs";
import { assertDocumentSlots } from "../services/billing";
import { removeDocument, SUPPORTED_EXTENSIONS } from "../services/ingestion";

export const documentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

function validate(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) throw badRequest(`Unsupported file type ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
}

const keyFor = (workspaceId: string, docId: string, version: number, name: string) =>
  `${workspaceId}/documents/${docId}/v${version}/${name.replace(/[^\w.\-]+/g, "_")}`;

documentsRouter.get("/documents", async (req, res) => {
  const { workspaceId } = ctx(req);
  const items = await prisma.document.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  res.json({ items, ready: { openai: features.openai(), pinecone: features.pinecone(), r2: features.r2(), trigger: features.trigger() } });
});

documentsRouter.post("/documents", requireRole(...ADMIN), upload.array("files", 10), async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw badRequest("No files uploaded");
  files.forEach(validate);
  await assertDocumentSlots(workspaceId, files.length);

  const created = [];
  for (const file of files) {
    const name = Buffer.from(file.originalname, "latin1").toString("utf8");
    const doc = await prisma.document.create({
      data: { workspaceId, name, mimeType: file.mimetype, size: file.size, storageKey: "", uploadedById: userId },
    });
    const storageKey = keyFor(workspaceId, doc.id, 1, name);
    await storage.put(storageKey, file.buffer, file.mimetype);
    created.push(await prisma.document.update({ where: { id: doc.id }, data: { storageKey } }));
    await jobs.ingestDocument(doc.id);
  }
  res.status(201).json({ items: created });
});

/** Replace a document's file with a new version and re-index it. */
documentsRouter.put("/documents/:id", requireRole(...ADMIN), upload.single("file"), async (req, res) => {
  const { workspaceId } = ctx(req);
  const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!doc) throw notFound("Document not found");
  const file = req.file;
  if (!file) throw badRequest("No file uploaded");
  validate(file);
  const name = Buffer.from(file.originalname, "latin1").toString("utf8");
  const version = doc.version + 1;
  const storageKey = keyFor(workspaceId, doc.id, version, name);
  await storage.put(storageKey, file.buffer, file.mimetype);
  await storage.delete(doc.storageKey).catch(() => {});
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { name, mimeType: file.mimetype, size: file.size, storageKey, version, status: "UPLOADED", error: null },
  });
  await jobs.ingestDocument(doc.id);
  res.json(updated);
});

documentsRouter.post("/documents/:id/reindex", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!doc) throw notFound("Document not found");
  const updated = await prisma.document.update({ where: { id: doc.id }, data: { status: "UPLOADED", error: null } });
  await jobs.ingestDocument(doc.id);
  res.json(updated);
});

documentsRouter.get("/documents/:id/download", async (req, res) => {
  const { workspaceId } = ctx(req);
  const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!doc) throw notFound("Document not found");
  const buf = await storage.get(doc.storageKey);
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.name)}"`);
  res.send(buf);
});

documentsRouter.delete("/documents/:id", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!doc) throw notFound("Document not found");
  await removeDocument(doc.id);
  res.status(204).end();
});

/** Try the knowledge base from the dashboard. */
documentsRouter.post("/documents/search", async (req, res) => {
  const { workspaceId } = ctx(req);
  const query = String(req.body?.query ?? "").trim();
  if (!query) throw badRequest("query is required");
  const { retrieve } = await import("../services/rag/retrieval");
  const { chunks, diagnostics } = await retrieve(workspaceId, { query, queries: [query] });
  res.json({ results: chunks.map((c) => ({ score: c.score, documentId: c.documentId, documentName: c.documentName, section: c.section, text: c.text })), diagnostics });
});
