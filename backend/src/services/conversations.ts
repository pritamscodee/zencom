import { prisma, type Channel, type MessageRole, type Prisma } from "../lib/db";
import { realtime } from "./realtime";

export const conversationListInclude = {
  customer: true,
  assignee: { select: { id: true, name: true, email: true, image: true } },
  tickets: { select: { id: true, number: true, status: true, title: true, priority: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ConversationInclude;

export type ConversationWithRelations = Prisma.ConversationGetPayload<{ include: typeof conversationListInclude }>;

export function isInternal(message: { role: MessageRole; metadata: unknown }) {
  return message.role === "SYSTEM" && (message.metadata as any)?.internal === true;
}

async function emitConversation(conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, include: conversationListInclude });
  if (conv) realtime.toWorkspace(conv.workspaceId, "conversation:updated", conv);
  return conv;
}

export async function appendMessage(params: {
  conversationId: string;
  role: MessageRole;
  content: string;
  authorId?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      authorId: params.authorId ?? null,
      externalId: params.externalId ?? null,
      metadata: (params.metadata ?? undefined) as any,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  const internal = isInternal(message);
  const update: Prisma.ConversationUpdateInput = {};
  if (!internal) {
    update.lastMessageAt = message.createdAt;
    update.lastMessagePreview = params.content.slice(0, 160);
  }
  if (params.role === "CUSTOMER") update.unreadCount = { increment: 1 };
  const conv = await prisma.conversation.update({ where: { id: params.conversationId }, data: update });

  realtime.toWorkspace(conv.workspaceId, "message:new", { conversationId: conv.id, message });
  if (!internal) realtime.toConversation(conv.id, "message:new", publicMessage(message));
  await emitConversation(conv.id);

  return message;
}

/** What the widget visitor is allowed to see. */
export function publicMessage(m: { id: string; conversationId: string; role: MessageRole; content: string; createdAt: Date; author?: { name: string; image: string | null } | null }) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    authorName: m.role === "AGENT" ? m.author?.name ?? "Support" : undefined,
    authorImage: m.role === "AGENT" ? m.author?.image ?? null : undefined,
  };
}

/** Always start a fresh conversation (widget "Send us a message"). */
export async function createConversation(workspaceId: string, customerId: string, channel: Channel) {
  const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  return prisma.conversation.create({ data: { workspaceId, customerId, channel, aiActive: settings?.aiEnabled ?? true } });
}

export async function findOrCreateOpenConversation(workspaceId: string, customerId: string, channel: Channel) {
  const existing = await prisma.conversation.findFirst({
    where: { workspaceId, customerId, channel, status: { in: ["OPEN", "PENDING"] } },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return existing;
  const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  const conv = await prisma.conversation.create({
    data: { workspaceId, customerId, channel, aiActive: settings?.aiEnabled ?? true },
  });
  return conv;
}

/** Entry point for every inbound customer message (website widget). */
export async function receiveCustomerMessage(params: {
  workspaceId: string;
  customerId: string;
  channel: Channel;
  content: string;
  externalId?: string;
  conversationId?: string;
}) {
  let conv = params.conversationId
    ? await prisma.conversation.findFirst({ where: { id: params.conversationId, workspaceId: params.workspaceId, customerId: params.customerId } })
    : null;
  conv ??= await findOrCreateOpenConversation(params.workspaceId, params.customerId, params.channel);

  if (conv.status === "RESOLVED") {
    const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId: params.workspaceId } });
    conv = await prisma.conversation.update({
      where: { id: conv.id },
      data: { status: "OPEN", aiActive: settings?.aiEnabled ?? true, escalatedAt: null, escalationReason: null },
    });
  }
  if (!conv.subject) {
    await prisma.conversation.update({ where: { id: conv.id }, data: { subject: params.content.slice(0, 80) } });
  }
  await prisma.customer.update({ where: { id: params.customerId }, data: { lastSeenAt: new Date() } });

  const message = await appendMessage({
    conversationId: conv.id,
    role: "CUSTOMER",
    content: params.content,
    externalId: params.externalId,
  });

  if (conv.aiActive) {
    const { scheduleAgentReply } = await import("./agent");
    scheduleAgentReply(conv.id);
  }
  return { conversation: conv, message };
}

export async function escalateConversation(conversationId: string, reason: string) {
  const conv = await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiActive: false, status: "PENDING", escalatedAt: new Date(), escalationReason: reason.slice(0, 500) },
  });
  await appendMessage({
    conversationId,
    role: "SYSTEM",
    content: `Escalated to a human agent: ${reason}`,
    metadata: { internal: true, kind: "escalation" },
  });
  realtime.toWorkspace(conv.workspaceId, "conversation:escalated", { conversationId, reason });
  return conv;
}

export { emitConversation };
