import { prisma, type Prisma, type TicketPriority, type TicketStatus } from "../lib/db";
import { env } from "../lib/env";
import { realtime } from "./realtime";
import { appendMessage } from "./conversations";
import { slackPostTicket } from "../integrations/slack";
import { linearCreateIssue } from "../integrations/linear";

export const ticketInclude = {
  customer: true,
  assignee: { select: { id: true, name: true, email: true, image: true } },
  conversation: { select: { id: true, channel: true, status: true, subject: true } },
} satisfies Prisma.TicketInclude;

export const ticketDetailInclude = {
  ...ticketInclude,
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { id: true, name: true, image: true } } },
  },
} satisfies Prisma.TicketInclude;

async function emitTicket(ticketId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketInclude });
  if (t) realtime.toWorkspace(t.workspaceId, "ticket:updated", t);
  return t;
}

export async function logActivity(ticketId: string, type: string, message: string, actorId?: string | null, data?: Record<string, unknown>) {
  return prisma.ticketActivity.create({
    data: { ticketId, type, message, actorId: actorId ?? null, data: (data ?? undefined) as any },
  });
}

export type TicketInput = {
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  proposedResolution?: string | null;
};

/**
 * Create a ticket for a conversation, or update the existing open one (dedupe):
 * one active ticket per conversation.
 */
export async function upsertTicketForConversation(params: {
  workspaceId: string;
  conversationId: string | null;
  customerId: string | null;
  input: TicketInput;
  byAi: boolean;
  actorId?: string | null;
}) {
  const { workspaceId, conversationId, customerId, input, byAi } = params;
  const existing = conversationId
    ? await prisma.ticket.findFirst({
        where: { workspaceId, conversationId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (existing) {
    const t = await prisma.ticket.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        priority: input.priority,
        category: input.category,
        proposedResolution: input.proposedResolution ?? existing.proposedResolution,
      },
    });
    await logActivity(t.id, "updated", byAi ? "AI updated the ticket with new details" : "Ticket updated", params.actorId);
    await emitTicket(t.id);
    return { ticket: t, created: false };
  }

  const t = await prisma.ticket.create({
    data: {
      workspaceId,
      conversationId,
      customerId,
      title: input.title.slice(0, 200),
      description: input.description,
      category: input.category.toLowerCase(),
      priority: input.priority,
      proposedResolution: input.proposedResolution ?? null,
      createdByAi: byAi,
    },
  });
  await logActivity(t.id, "created", byAi ? "Ticket created automatically by AI" : "Ticket created", params.actorId);
  if (conversationId) {
    await appendMessage({
      conversationId,
      role: "SYSTEM",
      content: `Ticket #${t.number} created: ${t.title}`,
      metadata: { internal: true, kind: "ticket", ticketId: t.id },
    });
  }
  await emitTicket(t.id);
  realtime.toWorkspace(workspaceId, "ticket:created", { id: t.id, number: t.number, title: t.title });
  return { ticket: t, created: true };
}

export async function updateTicket(
  workspaceId: string,
  ticketId: string,
  actorId: string,
  data: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null; title?: string; description?: string; category?: string; proposedResolution?: string | null },
) {
  const before = await prisma.ticket.findFirst({ where: { id: ticketId, workspaceId } });
  if (!before) return null;
  const t = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...data,
      resolvedAt: data.status && ["RESOLVED", "CLOSED"].includes(data.status) ? before.resolvedAt ?? new Date() : data.status ? null : undefined,
    },
  });
  if (data.status && data.status !== before.status) await logActivity(t.id, "status", `Status changed from ${before.status} to ${data.status}`, actorId);
  if (data.priority && data.priority !== before.priority) await logActivity(t.id, "priority", `Priority changed to ${data.priority}`, actorId);
  if (data.assigneeId !== undefined && data.assigneeId !== before.assigneeId) {
    const user = data.assigneeId ? await prisma.user.findUnique({ where: { id: data.assigneeId } }) : null;
    await logActivity(t.id, "assigned", user ? `Assigned to ${user.name}` : "Unassigned", actorId);
  }
  if (data.title || data.description || data.category || data.proposedResolution !== undefined) {
    await logActivity(t.id, "edited", "Ticket details edited", actorId);
  }
  return emitTicket(t.id);
}

/** Approve / Resolve. Optionally send the proposed resolution to the customer. */
export async function resolveTicket(workspaceId: string, ticketId: string, actorId: string, opts: { sendResolution?: boolean; resolution?: string }) {
  const t = await prisma.ticket.findFirst({ where: { id: ticketId, workspaceId } });
  if (!t) return null;
  const resolution = opts.resolution ?? t.proposedResolution ?? undefined;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "RESOLVED", resolvedAt: new Date(), proposedResolution: resolution ?? t.proposedResolution },
  });
  await logActivity(t.id, "resolved", opts.sendResolution && resolution ? "Resolution approved and sent to customer" : "Marked as resolved", actorId);

  if (opts.sendResolution && resolution && t.conversationId) {
    await appendMessage({ conversationId: t.conversationId, role: "AGENT", content: resolution, authorId: actorId });
  }
  return emitTicket(t.id);
}

export async function sendTicketToProvider(ticketId: string, provider: "SLACK" | "LINEAR", actorId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true } });
  if (!t) throw new Error("Ticket not found");
  const payload = {
    number: t.number,
    title: t.title,
    description: t.description,
    priority: t.priority,
    category: t.category,
    status: t.status,
    customer: t.customer ? t.customer.name || t.customer.email || t.customer.phone : null,
    url: `${env.FRONTEND_URL}/app/tickets/${t.id}`,
  };
  const links = ((t.externalLinks ?? {}) as Record<string, any>) || {};

  try {
    if (provider === "SLACK") {
      const r = await slackPostTicket(t.workspaceId, payload);
      links.slack = { channel: r.channel, ts: r.ts, url: r.url, sentAt: new Date().toISOString() };
      await logActivity(t.id, "sent", "Sent to Slack", actorId, links.slack);
    } else {
      const issue = await linearCreateIssue(t.workspaceId, payload);
      links.linear = { id: issue.id, identifier: issue.identifier, url: issue.url, sentAt: new Date().toISOString() };
      await logActivity(t.id, "sent", `Linear issue ${issue.identifier} created`, actorId, links.linear);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logActivity(t.id, "send_failed", `Failed to send to ${provider === "SLACK" ? "Slack" : "Linear"}: ${message}`, actorId);
    await emitTicket(t.id);
    throw e;
  }

  await prisma.ticket.update({
    where: { id: t.id },
    data: { externalLinks: links, status: t.status === "OPEN" ? "IN_PROGRESS" : t.status },
  });
  return emitTicket(t.id);
}
