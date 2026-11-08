"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button, Chip, SearchField, Spinner } from "@heroui/react";
import { Bot, Plus, Ticket as TicketIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { useRealtime } from "@/components/app/workspace-provider";
import { ChannelIcon } from "@/components/app/channel-icon";
import { TicketFormModal } from "@/components/tickets/ticket-form-modal";
import { Picker, Segmented } from "@/components/ui/pickers";
import { useDebounced, useFetch } from "@/lib/hooks";
import { customerName, PRIORITY_META, TICKET_STATUS_META, timeAgo } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/lib/types";

type StatusFilter = "ACTIVE" | TicketStatus | "ALL";

export default function TicketsPage() {
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [priority, setPriority] = useState("ALL");
  const [assignee, setAssignee] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const q = useDebounced(search);
  const { data, loading, reload } = useFetch<{ items: Ticket[]; counts: Partial<Record<TicketStatus, number>> }>("/api/tickets", {
    status,
    priority: priority === "ALL" ? undefined : priority,
    assignee,
    search: q || undefined,
  });
  useRealtime("ticket:updated", useCallback(() => reload(true), [reload]));

  const c = data?.counts ?? {};

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Tickets"
        description="Issues the AI identified in conversations, plus tickets your team created. Approve a resolution or send it to Slack or Linear."
        actions={
          <Button onPress={() => setOpen(true)}>
            <Plus className="size-4" /> New ticket
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8 py-4">
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { id: "ACTIVE", label: "Active", count: (c.OPEN ?? 0) + (c.IN_PROGRESS ?? 0) },
            { id: "OPEN", label: "Open" },
            { id: "IN_PROGRESS", label: "In progress" },
            { id: "RESOLVED", label: "Resolved" },
            { id: "CLOSED", label: "Closed" },
            { id: "ALL", label: "All" },
          ]}
        />
        <Picker
          label="Priority"
          hideLabel
          className="w-36"
          value={priority}
          onChange={(v) => setPriority(v ?? "ALL")}
          options={[{ id: "ALL", label: "Any priority" }, ...(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => ({ id: p, label: PRIORITY_META[p].label }))]}
        />
        <Picker
          label="Assignee"
          hideLabel
          className="w-40"
          value={assignee}
          onChange={(v) => setAssignee(v ?? "all")}
          options={[
            { id: "all", label: "Anyone" },
            { id: "me", label: "Assigned to me" },
            { id: "unassigned", label: "Unassigned" },
          ]}
        />
        <SearchField aria-label="Search tickets" value={search} onChange={setSearch} className="w-full sm:ml-auto sm:w-64">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search or #number" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="zc-scroll flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8">
        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : data?.items.length === 0 ? (
          <EmptyState icon={<TicketIcon className="size-5" />} title="No tickets" description="When the AI detects a bug, billing issue or anything needing follow-up, a ticket shows up here." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-separator">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-default/40 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ticket</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Assignee</th>
                  <th className="px-4 py-2.5 text-right font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((t) => (
                  <tr key={t.id} className="border-t border-separator hover:bg-default/30">
                    <td className="max-w-md px-4 py-3">
                      <Link href={`/app/tickets/${t.id}`} className="block">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          #{t.number} · {t.category.replace("_", " ")}
                          {t.createdByAi ? (
                            <span className="inline-flex items-center gap-0.5 text-accent">
                              <Bot className="size-3" /> AI
                            </span>
                          ) : null}
                          {t.externalLinks?.linear ? <span>· {t.externalLinks.linear.identifier}</span> : null}
                          {t.externalLinks?.slack ? <span>· Slack</span> : null}
                        </div>
                        <div className="mt-0.5 truncate font-medium">{t.title}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {t.conversation ? <ChannelIcon channel={t.conversation.channel} /> : null}
                        <span className="truncate">{t.customer ? customerName(t.customer) : "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Chip size="sm" variant="soft" color={PRIORITY_META[t.priority].color}>
                        {PRIORITY_META[t.priority].label}
                      </Chip>
                    </td>
                    <td className="px-4 py-3">
                      <Chip size="sm" variant="soft" color={TICKET_STATUS_META[t.status].color}>
                        {TICKET_STATUS_META[t.status].label}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.assignee?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">{timeAgo(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <TicketFormModal isOpen={open} onOpenChange={setOpen} onCreated={() => reload(true)} />
    </div>
  );
}
