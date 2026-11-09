import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { setIO, realtime } from "../services/realtime";
import { appendMessage, createConversation, isInternal, publicMessage, receiveCustomerMessage } from "../services/conversations";
import { getSettingsByPublicKey } from "../services/workspace";

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });
  setIO(io);

  // ─────────────── Dashboard (team members) ───────────────
  const agentNs = io.of("/agent");
  agentNs.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== env.FRONTEND_URL) return next(new Error("Origin not allowed"));
      // The dashboard's session cookie lives on the frontend's domain (API calls are proxied there), so the
      // client passes its session token in the handshake; the cookie still works when both share a site.
      const token = String(socket.handshake.auth?.token ?? "");
      const session = token
        ? await prisma.session
            .findUnique({ where: { token }, include: { user: true } })
            .then((s) => (s && s.expiresAt > new Date() ? s : null))
        : await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
      if (!session) return next(new Error("Unauthorized"));
      const workspaceId = String(socket.handshake.auth?.workspaceId ?? "");
      const member = await prisma.member.findFirst({ where: { userId: session.user.id, organizationId: workspaceId } });
      if (!member) return next(new Error("Forbidden"));
      socket.data = { userId: session.user.id, name: session.user.name, workspaceId };
      next();
    } catch (e) {
      next(e as Error);
    }
  });

  agentNs.on("connection", (socket) => {
    const { workspaceId, userId, name } = socket.data as { workspaceId: string; userId: string; name: string };
    socket.join(`ws:${workspaceId}`);

    socket.on("typing", async ({ conversationId, typing }: { conversationId: string; typing: boolean }) => {
      const conv = await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId }, select: { id: true } });
      if (!conv) return;
      realtime.toConversation(conv.id, "typing", { conversationId: conv.id, role: "AGENT", typing: Boolean(typing), name });
      socket.to(`ws:${workspaceId}`).emit("typing", { conversationId, role: "AGENT", typing: Boolean(typing), userId, name });
    });
  });

  // ─────────────── Website widget (anonymous visitors) ───────────────
  const widgetNs = io.of("/widget");
  const VisitorId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

  widgetNs.use(async (socket, next) => {
    try {
      const publicKey = String(socket.handshake.auth?.publicKey ?? "");
      const visitorId = VisitorId.parse(socket.handshake.auth?.visitorId);
      const settings = await getSettingsByPublicKey(publicKey);
      if (!settings) return next(new Error("Unknown widget key"));
      socket.data = { workspaceId: settings.workspaceId, visitorId };
      next();
    } catch {
      next(new Error("Invalid widget session"));
    }
  });

  widgetNs.on("connection", async (socket) => {
    const { workspaceId, visitorId } = socket.data as { workspaceId: string; visitorId: string };

    const getCustomer = () => prisma.customer.findUnique({ where: { workspaceId_visitorId: { workspaceId, visitorId } } });
    const ensureCustomer = async () =>
      prisma.customer.upsert({
        where: { workspaceId_visitorId: { workspaceId, visitorId } },
        create: { workspaceId, visitorId, metadata: { userAgent: socket.handshake.headers["user-agent"] ?? null, referrer: socket.handshake.auth?.pageUrl ?? null } },
        update: { lastSeenAt: new Date() },
      });
    const ownConversation = async (conversationId: unknown) => {
      const customer = await getCustomer();
      if (!customer || typeof conversationId !== "string") return null;
      return prisma.conversation.findFirst({ where: { id: conversationId, workspaceId, customerId: customer.id, channel: "WEB" } });
    };

    // Join every conversation room this visitor owns, so updates arrive on any screen of the messenger.
    const existing = await getCustomer();
    if (existing) {
      const convs = await prisma.conversation.findMany({ where: { workspaceId, customerId: existing.id, channel: "WEB" }, select: { id: true } });
      convs.forEach((c) => socket.join(`conv:${c.id}`));
    }

    /** Messenger bootstrap: identity + conversation list. */
    socket.on("session", async (_: unknown, ack?: (r: unknown) => void) => {
      const customer = await getCustomer();
      if (!customer) return ack?.({ customer: null, conversations: [] });
      ack?.({ customer: { name: customer.name, email: customer.email }, conversations: await listConversations(customer.id) });
    });

    const listConversations = async (customerId: string) => {
      const convs = await prisma.conversation.findMany({
        where: { workspaceId, customerId, channel: "WEB" },
        orderBy: { lastMessageAt: "desc" },
        take: 30,
        include: {
          assignee: { select: { name: true, image: true } },
          messages: { where: { role: { in: ["CUSTOMER", "AI", "AGENT"] } }, orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true, image: true } } } },
        },
      });
      return convs.map((c) => ({
        id: c.id,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.messages[0] ? publicMessage(c.messages[0]) : null,
        assignee: c.assignee,
        aiActive: c.aiActive,
      }));
    };

    socket.on("conversations", async (_: unknown, ack?: (r: unknown) => void) => {
      const customer = await getCustomer();
      ack?.({ conversations: customer ? await listConversations(customer.id) : [] });
    });

    socket.on("open", async (payload: { conversationId?: string }, ack?: (r: unknown) => void) => {
      const conv = await ownConversation(payload?.conversationId);
      if (!conv) return ack?.({ ok: false, error: "Conversation not found" });
      socket.join(`conv:${conv.id}`);
      const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "asc" },
        take: 300,
        include: { author: { select: { name: true, image: true } } },
      });
      ack?.({ ok: true, conversation: { id: conv.id, status: conv.status, aiActive: conv.aiActive }, messages: messages.filter((m) => !isInternal(m)).map(publicMessage) });
    });

    /** Send a message. Without conversationId a new conversation is started. */
    socket.on("message:send", async (payload: { content?: string; conversationId?: string | null }, ack?: (r: unknown) => void) => {
      try {
        const content = String(payload?.content ?? "").trim().slice(0, 4000);
        if (!content) return ack?.({ ok: false, error: "Empty message" });
        const customer = await ensureCustomer();
        let conversationId: string | undefined;
        if (payload?.conversationId) {
          const conv = await ownConversation(payload.conversationId);
          if (!conv) return ack?.({ ok: false, error: "Conversation not found" });
          conversationId = conv.id;
        } else {
          conversationId = (await createConversation(workspaceId, customer.id, "WEB")).id;
        }
        socket.join(`conv:${conversationId}`);
        const { conversation, message } = await receiveCustomerMessage({ workspaceId, customerId: customer.id, channel: "WEB", content, conversationId });
        ack?.({ ok: true, conversationId: conversation.id, message: publicMessage(message) });
      } catch (e) {
        console.error("[widget message]", e);
        ack?.({ ok: false, error: "Could not send message" });
      }
    });

    socket.on("identify", async (payload: { name?: string; email?: string; conversationId?: string }, ack?: (r: unknown) => void) => {
      const parsed = z.object({ name: z.string().max(120).optional(), email: z.string().email().max(200).optional() }).safeParse({ name: payload?.name, email: payload?.email });
      if (!parsed.success) return ack?.({ ok: false, error: "Please enter a valid email" });
      const customer = await ensureCustomer();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.email ? { email: parsed.data.email.toLowerCase() } : {}) },
      });
      const conv = await ownConversation(payload?.conversationId);
      if (conv && parsed.data.email) {
        await appendMessage({ conversationId: conv.id, role: "SYSTEM", content: `Visitor shared their email: ${parsed.data.email}`, metadata: { internal: true, kind: "event" } });
      }
      ack?.({ ok: true });
    });

    socket.on("typing", async ({ typing, conversationId }: { typing: boolean; conversationId?: string }) => {
      const conv = await ownConversation(conversationId);
      if (conv) realtime.toWorkspace(workspaceId, "typing", { conversationId: conv.id, role: "CUSTOMER", typing: Boolean(typing) });
    });
  });

  return io;
}
