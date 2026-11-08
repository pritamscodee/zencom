import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "../lib/db";
import { badRequest, notFound, param } from "../lib/http";
import { ctx } from "../middleware/auth";
import { resolveTicket, ticketDetailInclude, ticketInclude, updateTicket, upsertTicketForConversation } from "../services/tickets";
import { jobs } from "../services/jobs";
import { getIntegration } from "../integrations/store";

export const ticketsRouter = Router();

const Priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const Status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

ticketsRouter.get("/tickets", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const q = z
    .object({
      status: z.union([Status, z.literal("ACTIVE"), z.literal("ALL")]).default("ACTIVE"),
      priority: Priority.optional(),
      assignee: z.enum(["me", "unassigned", "all"]).default("all"),
      search: z.string().optional(),
    })
    .parse(req.query);
  const where: Prisma.TicketWhereInput = { workspaceId };
  if (q.status === "ACTIVE") where.status = { in: ["OPEN", "IN_PROGRESS"] };
  else if (q.status !== "ALL") where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.assignee === "me") where.assigneeId = userId;
  if (q.assignee === "unassigned") where.assigneeId = null;
  if (q.search) {
    const n = Number(q.search.replace("#", ""));
    where.OR = [
      { title: { contains: q.search, mode: "insensitive" } },
      { description: { contains: q.search, mode: "insensitive" } },
      ...(Number.isInteger(n) ? [{ number: n }] : []),
    ];
  }
  const [items, counts] = await Promise.all([
    prisma.ticket.findMany({ where, include: ticketInclude, orderBy: [{ createdAt: "desc" }], take: 200 }),
    prisma.ticket.groupBy({ by: ["status"], where: { workspaceId }, _count: true }),
  ]);
  res.json({ items, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) });
});

ticketsRouter.get("/tickets/:id", async (req, res) => {
  const { workspaceId } = ctx(req);
  const t = await prisma.ticket.findFirst({ where: { id: param(req, "id"), workspaceId }, include: ticketDetailInclude });
  if (!t) throw notFound("Ticket not found");
  const [slack, linear] = await Promise.all([getIntegration(workspaceId, "SLACK"), getIntegration(workspaceId, "LINEAR")]);
  res.json({ ...t, destinations: { slack: Boolean(slack), linear: Boolean(linear) } });
});

ticketsRouter.post("/tickets", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const body = z
    .object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(10000),
      category: z.string().default("general"),
      priority: Priority.default("MEDIUM"),
      conversationId: z.string().nullable().default(null),
      proposedResolution: z.string().nullable().default(null),
    })
    .parse(req.body);
  let customerId: string | null = null;
  if (body.conversationId) {
    const conv = await prisma.conversation.findFirst({ where: { id: body.conversationId, workspaceId } });
    if (!conv) throw notFound("Conversation not found");
    customerId = conv.customerId;
  }
  const { ticket } = await upsertTicketForConversation({
    workspaceId,
    conversationId: body.conversationId,
    customerId,
    byAi: false,
    actorId: userId,
    input: body,
  });
  res.status(201).json(ticket);
});

ticketsRouter.patch("/tickets/:id", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const body = z
    .object({
      status: Status,
      priority: Priority,
      assigneeId: z.string().nullable(),
      title: z.string().min(1).max(200),
      description: z.string().max(10000),
      category: z.string().max(40),
      proposedResolution: z.string().max(8000).nullable(),
    })
    .partial()
    .parse(req.body);
  if (body.assigneeId) {
    const m = await prisma.member.findFirst({ where: { organizationId: workspaceId, userId: body.assigneeId } });
    if (!m) throw badRequest("Assignee is not a workspace member");
  }
  const t = await updateTicket(workspaceId, param(req, "id"), userId, body);
  if (!t) throw notFound("Ticket not found");
  res.json(t);
});

/** Primary action 1: Approve / Resolve. */
ticketsRouter.post("/tickets/:id/resolve", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const body = z.object({ sendResolution: z.boolean().default(false), resolution: z.string().max(8000).optional() }).parse(req.body ?? {});
  const t = await resolveTicket(workspaceId, param(req, "id"), userId, body);
  if (!t) throw notFound("Ticket not found");
  res.json(t);
});

/** Primary action 2: Send to Slack / Linear. */
ticketsRouter.post("/tickets/:id/send", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const { provider } = z.object({ provider: z.enum(["SLACK", "LINEAR"]) }).parse(req.body);
  const t = await prisma.ticket.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!t) throw notFound("Ticket not found");
  if (!(await getIntegration(workspaceId, provider))) throw badRequest(`${provider === "SLACK" ? "Slack" : "Linear"} is not connected`);
  const result = await jobs.sendTicket({ ticketId: t.id, provider, actorId: userId });
  res.json(result);
});
