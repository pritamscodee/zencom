import type { Server } from "socket.io";

/**
 * Socket.IO fan-out helpers.
 *  - Dashboard namespace "/agent": room `ws:<workspaceId>`
 *  - Widget namespace "/widget":   room `conv:<conversationId>`
 * When running inside a Trigger.dev worker there is no io instance; emits become no-ops.
 */
let io: Server | null = null;

export function setIO(server: Server) {
  io = server;
}

export const realtime = {
  toWorkspace(workspaceId: string, event: string, payload: unknown) {
    io?.of("/agent").to(`ws:${workspaceId}`).emit(event, payload);
  },
  toConversation(conversationId: string, event: string, payload: unknown) {
    io?.of("/widget").to(`conv:${conversationId}`).emit(event, payload);
  },
};
