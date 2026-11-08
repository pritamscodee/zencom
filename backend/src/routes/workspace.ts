import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { env, features } from "../lib/env";
import { ADMIN, ctx, requireRole } from "../middleware/auth";
import { ensureWorkspaceSettings } from "../services/workspace";

export const workspaceRouter = Router();

workspaceRouter.get("/workspace", async (req, res) => {
  const { workspaceId, role, user } = ctx(req);
  const workspace = await prisma.organization.findUniqueOrThrow({ where: { id: workspaceId } });
  const settings = await ensureWorkspaceSettings(workspaceId, workspace.name);
  res.json({
    workspace,
    settings,
    role,
    user,
    embed: {
      scriptUrl: `${env.BACKEND_URL}/widget.js`,
      snippet: `<script src="${env.BACKEND_URL}/widget.js" data-zencom-key="${settings.publicKey}" async></script>`,
    },
    features: {
      openai: features.openai(),
      pinecone: features.pinecone(),
      r2: features.r2(),
      trigger: features.trigger(),
      hubspot: features.hubspot(),
      slack: features.slack(),
      linear: features.linear(),
      email: features.email(),
      billing: features.billing(),
      langfuse: features.langfuse(),
    },
  });
});

const SettingsSchema = z
  .object({
    businessName: z.string().max(120).nullable(),
    businessDescription: z.string().max(4000).nullable(),
    website: z.string().max(300).nullable(),
    supportEmail: z.string().max(200).nullable(),
    aiEnabled: z.boolean(),
    aiName: z.string().min(1).max(40),
    aiInstructions: z.string().max(8000).nullable(),
    confidenceThreshold: z.number().min(0).max(1),
    autoCreateTickets: z.boolean(),
    widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    widgetGreeting: z.string().max(300),
    widgetPosition: z.enum(["left", "right"]),
    askForEmail: z.boolean(),
  })
  .partial();

workspaceRouter.patch("/workspace/settings", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const data = SettingsSchema.parse(req.body);
  const settings = await prisma.workspaceSettings.update({ where: { workspaceId }, data });
  res.json(settings);
});

workspaceRouter.patch("/workspace", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const data = z.object({ name: z.string().min(1).max(80), logo: z.string().url().nullable() }).partial().parse(req.body);
  res.json(await prisma.organization.update({ where: { id: workspaceId }, data }));
});

workspaceRouter.post("/workspace/rotate-key", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const { randomToken } = await import("../lib/crypto");
  res.json(await prisma.workspaceSettings.update({ where: { workspaceId }, data: { publicKey: `zc_${randomToken(16)}` } }));
});

/** Dashboard overview numbers. */
workspaceRouter.get("/stats", async (req, res) => {
  const { workspaceId } = ctx(req);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [open, pending, resolved7d, openTickets, aiMessages7d, agentMessages7d, escalated7d, docs] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, status: "OPEN" } }),
    prisma.conversation.count({ where: { workspaceId, status: "PENDING" } }),
    prisma.conversation.count({ where: { workspaceId, status: "RESOLVED", updatedAt: { gte: since } } }),
    prisma.ticket.count({ where: { workspaceId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.message.count({ where: { conversation: { workspaceId }, role: "AI", createdAt: { gte: since } } }),
    prisma.message.count({ where: { conversation: { workspaceId }, role: "AGENT", createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { workspaceId, escalatedAt: { gte: since } } }),
    prisma.document.count({ where: { workspaceId, status: "READY" } }),
  ]);
  const totalReplies = aiMessages7d + agentMessages7d;
  res.json({
    open,
    pending,
    resolved7d,
    openTickets,
    aiMessages7d,
    agentMessages7d,
    escalated7d,
    docs,
    aiShare: totalReplies ? aiMessages7d / totalReplies : 0,
  });
});
