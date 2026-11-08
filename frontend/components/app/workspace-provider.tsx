"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { Spinner, toast } from "@heroui/react";
import { api, ApiError, workspaceStore } from "@/lib/api";
import { API_URL } from "@/lib/config";
import type { MemberRow, WorkspaceInfo } from "@/lib/types";

type Ctx = {
  info: WorkspaceInfo;
  refresh: () => Promise<void>;
  socket: Socket | null;
  members: MemberRow[];
  reloadMembers: () => Promise<void>;
  isAdmin: boolean;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** Subscribe to a realtime event for the lifetime of the component. */
export function useRealtime<T = any>(event: string, handler: (payload: T) => void) {
  const { socket } = useWorkspace();
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<WorkspaceInfo>("/api/workspace");
      workspaceStore.set(data.workspace.id);
      setInfo(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        workspaceStore.clear();
        router.replace("/onboarding");
      } else toast.danger("Could not reach the Zencom API", { description: (e as Error).message });
    }
  }, [router, pathname]);

  const reloadMembers = useCallback(async () => {
    const res = await api<{ members: MemberRow[] }>("/api/members").catch(() => null);
    if (res) setMembers(res.members);
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workspaceId = info?.workspace.id;
  useEffect(() => {
    if (!workspaceId) return;
    reloadMembers();
    const s = io(`${API_URL}/agent`, { withCredentials: true, auth: { workspaceId }, transports: ["websocket", "polling"] });
    s.on("conversation:escalated", (p: { conversationId: string; reason: string }) => {
      toast.warning("Conversation needs a human", {
        description: p.reason,
        actionProps: { children: "Open", onPress: () => router.push(`/app/inbox/${p.conversationId}`), variant: "tertiary" },
      });
    });
    s.on("ticket:created", (p: { id: string; number: number; title: string }) => {
      toast(`Ticket #${p.number} created`, {
        description: p.title,
        actionProps: { children: "View", onPress: () => router.push(`/app/tickets/${p.id}`), variant: "tertiary" },
      });
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [workspaceId, reloadMembers, router]);

  const value = useMemo<Ctx | null>(
    () => (info ? { info, refresh, socket, members, reloadMembers, isAdmin: info.role === "owner" || info.role === "admin" } : null),
    [info, refresh, socket, members, reloadMembers],
  );

  if (!value) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
