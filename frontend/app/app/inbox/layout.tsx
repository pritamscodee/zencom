"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { SearchField, Spinner } from "@heroui/react";
import { Bot, Inbox as InboxIcon, UserRound } from "lucide-react";
import { useRealtime, useWorkspace } from "@/components/app/workspace-provider";
import { ChannelIcon } from "@/components/app/channel-icon";
import { Picker, Segmented } from "@/components/ui/pickers";
import { useDebounced, useFetch } from "@/lib/hooks";
import { customerName, timeAgo } from "@/lib/format";
import type { Conversation, ConversationStatus } from "@/lib/types";

type ListResponse = { items: Conversation[]; counts: Partial<Record<ConversationStatus, number>> };
type StatusFilter = ConversationStatus | "ACTIVE" | "ALL";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const { info } = useWorkspace();
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [assignee, setAssignee] = useState<"all" | "me" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);

  const { data, setData, loading, reload } = useFetch<ListResponse>("/api/conversations", {
    status,
    assignee,
    search: q || undefined,
  });

  const matches = useCallback(
    (c: Conversation) =>
      (status === "ALL" || (status === "ACTIVE" ? c.status !== "RESOLVED" : c.status === status)) &&
      (assignee === "all" || (assignee === "me" ? c.assigneeId === info.user.id : c.assigneeId === null)),
    [status, assignee, info.user.id],
  );

  useRealtime<Conversation>(
    "conversation:updated",
    useCallback(
      (conv) => {
        setData((prev) => {
          if (!prev) return prev;
          const rest = prev.items.filter((c) => c.id !== conv.id);
          const items = matches(conv) && !q ? [conv, ...rest] : rest;
          items.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
          return { ...prev, items };
        });
        reload(true);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [matches, q],
    ),
  );

  const counts = data?.counts ?? {};

  return (
    <div className="flex h-full">
      <section className={`w-full shrink-0 flex-col border-r border-separator md:flex md:w-[300px] lg:w-[340px] ${params.id ? "hidden" : "flex"}`}>
        <div className="space-y-3 border-b border-separator p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Inbox</h1>
            {loading ? <Spinner size="sm" /> : null}
          </div>
          <SearchField aria-label="Search conversations" value={search} onChange={setSearch}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search people or messages" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { id: "ACTIVE", label: "Active", count: (counts.OPEN ?? 0) + (counts.PENDING ?? 0) },
              { id: "OPEN", label: "Open" },
              { id: "PENDING", label: "Pending", count: counts.PENDING },
              { id: "RESOLVED", label: "Resolved" },
            ]}
          />
          <div>
            <Picker
              label="Assignee"
              hideLabel
              value={assignee}
              onChange={(v) => setAssignee((v as typeof assignee) ?? "all")}
              options={[
                { id: "all", label: "Everyone" },
                { id: "me", label: "Assigned to me" },
                { id: "unassigned", label: "Unassigned" },
              ]}
            />
          </div>
        </div>

        <ul className="zc-scroll flex-1 overflow-y-auto">
          {data?.items.length === 0 ? (
            <li className="flex flex-col items-center px-6 py-16 text-center text-sm text-muted">
              <InboxIcon className="mb-3 size-6" />
              No conversations here.
              <span className="mt-1 text-xs">Install the chat widget from Settings to start receiving messages.</span>
            </li>
          ) : null}
          {data?.items.map((c) => {
            const active = params.id === c.id;
            const name = customerName(c.customer);
            return (
              <li key={c.id}>
                <Link
                  href={`/app/inbox/${c.id}`}
                  className={`block border-b border-separator/70 px-4 py-3 transition-colors ${active ? "bg-accent/8" : "hover:bg-default/50"}`}
                >
                  <div className="flex items-center gap-2">
                    <ChannelIcon channel={c.channel} />
                    <span className={`flex-1 truncate text-sm ${c.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>{name}</span>
                    <span className="text-xs text-muted">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className={`mt-1 line-clamp-2 text-[13px] ${c.unreadCount > 0 ? "text-foreground" : "text-muted"}`}>
                    {c.lastMessagePreview ?? c.subject ?? "No messages yet"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {c.aiActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
                        <Bot className="size-3" /> AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-default px-2 py-0.5 font-medium text-foreground/80">
                        <UserRound className="size-3" /> {c.assignee ? c.assignee.name.split(" ")[0] : "Unassigned"}
                      </span>
                    )}
                    {c.status === "PENDING" ? <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">Needs human</span> : null}
                    {c.tickets.some((t) => t.status === "OPEN" || t.status === "IN_PROGRESS") ? (
                      <span className="rounded-full bg-default px-2 py-0.5 text-muted">#{c.tickets[0]!.number}</span>
                    ) : null}
                    {c.unreadCount > 0 ? <span className="ml-auto size-2 rounded-full bg-accent" /> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={`min-w-0 flex-1 ${params.id ? "block" : "hidden md:block"}`}>{children}</section>
    </div>
  );
}
