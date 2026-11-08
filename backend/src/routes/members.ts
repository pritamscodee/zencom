import { Router } from "express";
import { prisma } from "../lib/db";
import { ctx } from "../middleware/auth";

export const membersRouter = Router();

/** Members + pending invitations + activity/ownership stats. Mutations go through Better Auth's organization API. */
membersRouter.get("/members", async (req, res) => {
  const { workspaceId } = ctx(req);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: workspaceId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: workspaceId, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const userIds = members.map((m) => m.userId);
  const [openConvos, openTickets, resolvedTickets, replies] = await Promise.all([
    prisma.conversation.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { in: userIds }, status: { in: ["OPEN", "PENDING"] } }, _count: true }),
    prisma.ticket.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { in: userIds }, status: { in: ["OPEN", "IN_PROGRESS"] } }, _count: true }),
    prisma.ticket.groupBy({ by: ["assigneeId"], where: { workspaceId, assigneeId: { in: userIds }, status: "RESOLVED", resolvedAt: { gte: since } }, _count: true }),
    prisma.message.groupBy({ by: ["authorId"], where: { conversation: { workspaceId }, authorId: { in: userIds }, role: "AGENT", createdAt: { gte: since } }, _count: true }),
  ]);
  const toMap = (rows: { _count: number; [k: string]: any }[], key: string) => new Map(rows.map((r) => [r[key], r._count]));
  const oc = toMap(openConvos, "assigneeId");
  const ot = toMap(openTickets, "assigneeId");
  const rt = toMap(resolvedTickets, "assigneeId");
  const rp = toMap(replies, "authorId");
  res.json({
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
      stats: { openConversations: oc.get(m.userId) ?? 0, openTickets: ot.get(m.userId) ?? 0, resolvedTickets7d: rt.get(m.userId) ?? 0, replies7d: rp.get(m.userId) ?? 0 },
    })),
    invitations,
  });
});

/** Recent ticket activity across the workspace (team activity feed). */
membersRouter.get("/activity", async (req, res) => {
  const { workspaceId } = ctx(req);
  const items = await prisma.ticketActivity.findMany({
    where: { ticket: { workspaceId } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { actor: { select: { id: true, name: true, image: true } }, ticket: { select: { id: true, number: true, title: true } } },
  });
  res.json({ items });
});
