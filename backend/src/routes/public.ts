import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/db";
import { env, features } from "../lib/env";
import { retrieve } from "../services/rag/retrieval";
import { notFound, param } from "../lib/http";
import { getSettingsByPublicKey } from "../services/workspace";

export const publicRouter = Router();

/** Public widget configuration (looked up by the workspace's public key). */
publicRouter.get("/api/public/widget/:key", async (req, res) => {
  const s = await getSettingsByPublicKey(param(req, "key"));
  if (!s) throw notFound("Unknown widget key");
  const [online, team] = await Promise.all([
    prisma.session.count({ where: { activeOrganizationId: s.workspaceId, updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } } }),
    prisma.member.findMany({ where: { organizationId: s.workspaceId }, take: 3, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, image: true } } } }),
  ]);
  res.json({
    workspaceName: s.businessName || s.workspace.name,
    logo: s.workspace.logo,
    color: s.widgetColor,
    greeting: s.widgetGreeting,
    position: s.widgetPosition,
    aiName: s.aiName,
    aiEnabled: s.aiEnabled,
    askForEmail: s.askForEmail,
    teamOnline: online > 0,
    // Only first names + avatars are public (shown on the messenger home screen).
    team: team.map((m) => ({ name: m.user.name.split(" ")[0], image: m.user.image })),
    helpEnabled: features.openai() && features.pinecone(),
  });
});

/** Help search for the messenger home screen: top knowledge-base passages for a visitor query. */
const searchHits = new Map<string, { n: number; t: number }>();
publicRouter.get("/api/public/widget/:key/search", async (req, res) => {
  const s = await getSettingsByPublicKey(param(req, "key"));
  if (!s) throw notFound("Unknown widget key");
  const q = String(req.query.q ?? "").trim().slice(0, 200);
  if (q.length < 3) return res.json({ results: [] });
  // Simple per-IP rate limit (30/min) — each search costs an embedding call.
  const ip = req.ip ?? "?";
  const hit = searchHits.get(ip);
  const now = Date.now();
  if (hit && now - hit.t < 60_000) {
    if (++hit.n > 30) return res.status(429).json({ error: "Too many searches" });
  } else searchHits.set(ip, { n: 1, t: now });
  const { chunks: results } = await retrieve(s.workspaceId, { query: q, queries: [q] }, { topK: 4 }).catch(() => ({ chunks: [] }));
  res.json({
    results: results.map((r) => ({ title: r.documentName.replace(/.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "), snippet: r.text.slice(0, 320), score: r.score })),
  });
});

/** Embeddable loader script: <script src=".../widget.js" data-zencom-key="zc_..."></script> */
let template: string | null = null;
publicRouter.get("/widget.js", async (_req, res) => {
  template ??= await readFile(path.resolve(process.cwd(), "public/widget.js"), "utf8");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(template.replaceAll("__FRONTEND_URL__", env.FRONTEND_URL));
});
