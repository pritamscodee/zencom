import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "../lib/db";
import { notFound, param } from "../lib/http";
import { ctx } from "../middleware/auth";
import { appendMessage, conversationListInclude, emitConversation } from "../services/conversations";
import { scheduleAgentReply } from "../services/agent";
import { ticketInclude } from "../services/tickets";
import { score } from "../lib/observability";

export const conversationsRouter = Router();

conversationsRouter.get("/conversations", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const q = z
    .object({
      status: z.enum(["ACTIVE", "OPEN", "PENDING", "RESOLVED", "ALL"]).default("ACTIVE"),
      channel: z.enum(["WEB"]).optional(),
      assignee: z.enum(["me", "unassigned", "all"]).default("all"),
      search: z.string().optional(),
      cursor: z.string().optional(),
    })
    .parse(req.query);

  const where: Prisma.ConversationWhereInput = { workspaceId };
  if (q.status === "ACTIVE") where.status = { in: ["OPEN", "PENDING"] };
  else if (q.status !== "ALL") where.status = q.status;
  if (q.channel) where.channel = q.channel;
  if (q.assignee === "me") where.assigneeId = userId;
  if (q.assignee === "unassigned") where.assigneeId = null;
  if (q.search) {
    where.OR = [
      { customer: { name: { contains: q.search, mode: "insensitive" } } },
      { customer: { email: { contains: q.search, mode: "insensitive" } } },
      { customer: { phone: { contains: q.search } } },
      { subject: { contains: q.search, mode: "insensitive" } },
      { messages: { some: { content: { contains: q.search, mode: "insensitive" } } } },
    ];
  }

  const items = await prisma.conversation.findMany({
    where,
    include: conversationListInclude,
    orderBy: { lastMessageAt: "desc" },
    take: 51,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const counts = await prisma.conversation.groupBy({ by: ["status"], where: { workspaceId }, _count: true });
  res.json({
    items: items.slice(0, 50),
    nextCursor: items.length > 50 ? items[49]!.id : null,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
});

conversationsRouter.get("/conversations/:id", async (req, res) => {
  const { workspaceId } = ctx(req);
  const conv = await prisma.conversation.findFirst({
    where: { id: param(req, "id"), workspaceId },
    include: {
      ...conversationListInclude,
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, image: true } } } },
    },
  });
  if (!conv) throw notFound("Conversation not found");
  const [otherConversations, tickets] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId, customerId: conv.customerId, NOT: { id: conv.id } },
      select: { id: true, subject: true, status: true, channel: true, lastMessageAt: true },
      orderBy: { lastMessageAt: "desc" },
      take: 10,
    }),
    prisma.ticket.findMany({ where: { workspaceId, conversationId: conv.id }, include: ticketInclude, orderBy: { createdAt: "desc" } }),
  ]);
  if (conv.unreadCount > 0) await prisma.conversation.update({ where: { id: conv.id }, data: { unreadCount: 0 } });
  res.json({ ...conv, unreadCount: 0, tickets, otherConversations });
});

/** Human agent reply. Sending a reply takes the conversation over from the AI. */
conversationsRouter.post("/conversations/:id/messages", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const body = z.object({ content: z.string().min(1).max(8000), internal: z.boolean().default(false) }).parse(req.body);
  const conv = await prisma.conversation.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!conv) throw notFound("Conversation not found");

  if (!body.internal && conv.aiActive) {
    // A human stepping in while the AI was active is an implicit quality signal on the last AI reply.
    const lastAi = await prisma.message.findFirst({ where: { conversationId: conv.id, role: "AI" }, orderBy: { createdAt: "desc" } });
    const traceId = (lastAi?.metadata as any)?.traceId;
    if (traceId) score({ traceId, name: "human_takeover", value: 1, dataType: "BOOLEAN" });
  }
  if (!body.internal && (conv.aiActive || !conv.assigneeId || conv.status !== "OPEN")) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { aiActive: false, assigneeId: conv.assigneeId ?? userId, status: conv.status === "RESOLVED" ? "OPEN" : conv.status === "PENDING" ? "OPEN" : conv.status },
    });
  }
  const message = await appendMessage({
    conversationId: conv.id,
    role: body.internal ? "SYSTEM" : "AGENT",
    content: body.content,
    authorId: userId,
    metadata: body.internal ? { internal: true, kind: "note" } : undefined,
  });
  res.status(201).json(message);
});

/** Agent thumbs up/down on an AI reply → Langfuse "agent_feedback" score on that reply's trace. */
conversationsRouter.post("/conversations/:id/messages/:messageId/feedback", async (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const body = z.object({ value: z.union([z.literal(1), z.literal(-1)]), comment: z.string().max(1000).optional() }).parse(req.body);
  const msg = await prisma.message.findFirst({
    where: { id: param(req, "messageId"), conversationId: param(req, "id"), role: "AI", conversation: { workspaceId } },
  });
  if (!msg) throw notFound("Message not found");
  const metadata = { ...((msg.metadata as Record<string, unknown>) ?? {}), feedback: { value: body.value, comment: body.comment ?? null, by: userId, at: new Date().toISOString() } };
  const updated = await prisma.message.update({ where: { id: msg.id }, data: { metadata: metadata as any } });
  const traceId = (msg.metadata as any)?.traceId;
  if (traceId) score({ traceId, name: "agent_feedback", value: body.value === 1 ? 1 : 0, dataType: "BOOLEAN", comment: body.comment, metadata: { userId } });
  res.json(updated);
});

conversationsRouter.patch("/conversations/:id", async (req, res) => {
  const { workspaceId, userId, user } = ctx(req);
  const body = z
    .object({
      status: z.enum(["OPEN", "PENDING", "RESOLVED"]).optional(),
      assigneeId: z.string().nullable().optional(),
      aiActive: z.boolean().optional(),
    })
    .parse(req.body);
  const conv = await prisma.conversation.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!conv) throw notFound("Conversation not found");

  if (body.assigneeId) {
    const member = await prisma.member.findFirst({ where: { organizationId: workspaceId, userId: body.assigneeId } });
    if (!member) throw notFound("Assignee is not a workspace member");
  }

  await prisma.conversation.update({ where: { id: conv.id }, data: body });

  const notes: string[] = [];
  if (body.status && body.status !== conv.status) notes.push(`${user.name} marked the conversation ${body.status.toLowerCase()}`);
  if (body.assigneeId !== undefined && body.assigneeId !== conv.assigneeId) {
    const a = body.assigneeId ? await prisma.user.findUnique({ where: { id: body.assigneeId } }) : null;
    notes.push(a ? `${user.name} assigned the conversation to ${a.id === userId ? "themself" : a.name}` : `${user.name} unassigned the conversation`);
  }
  if (body.aiActive !== undefined && body.aiActive !== conv.aiActive) {
    notes.push(body.aiActive ? `${user.name} handed the conversation back to AI` : `${user.name} took over from AI`);
  }
  for (const n of notes) {
    await appendMessage({ conversationId: conv.id, role: "SYSTEM", content: n, metadata: { internal: true, kind: "event" } });
  }
  const updated = await emitConversation(conv.id);
  if (body.aiActive === true && !conv.aiActive) scheduleAgentReply(conv.id);
  res.json(updated);
});

conversationsRouter.patch("/customers/:id", async (req, res) => {
  const { workspaceId } = ctx(req);
  const body = z.object({ name: z.string().max(120).nullable(), email: z.string().email().nullable(), phone: z.string().max(40).nullable() }).partial().parse(req.body);
  const c = await prisma.customer.findFirst({ where: { id: param(req, "id"), workspaceId } });
  if (!c) throw notFound();
  res.json(await prisma.customer.update({ where: { id: c.id }, data: body }));
});
