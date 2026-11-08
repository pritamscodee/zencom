"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Spinner, toast } from "@heroui/react";
import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, PanelRight, RotateCcw, UserRoundCheck } from "lucide-react";
import { useRealtime, useWorkspace } from "@/components/app/workspace-provider";
import { ChannelIcon, CHANNEL_LABEL } from "@/components/app/channel-icon";
import { MessageList } from "@/components/inbox/message-list";
import { Composer } from "@/components/inbox/composer";
import { CustomerPanel } from "@/components/inbox/customer-panel";
import { TicketFormModal } from "@/components/tickets/ticket-form-modal";
import { Picker } from "@/components/ui/pickers";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { CONVO_STATUS_META, customerName, errorMessage } from "@/lib/format";
import type { Conversation, ConversationDetail, ConversationStatus, Message } from "@/lib/types";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { members, info } = useWorkspace();
  const { data: conv, setData, loading, reload } = useFetch<ConversationDetail>(`/api/conversations/${id}`);
  const [typing, setTyping] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useRealtime<{ conversationId: string; message: Message }>(
    "message:new",
    useCallback(
      ({ conversationId, message }) => {
        if (conversationId !== id) return;
        setData((prev) => (prev && !prev.messages.some((m) => m.id === message.id) ? { ...prev, messages: [...prev.messages, message] } : prev));
        if (message.role === "CUSTOMER") api(`/api/conversations/${id}`).catch(() => {}); // marks read
      },
      [id, setData],
    ),
  );

  useRealtime<Conversation>(
    "conversation:updated",
    useCallback(
      (c) => {
        if (c.id !== id) return;
        setData((prev) => (prev ? { ...prev, status: c.status, aiActive: c.aiActive, assigneeId: c.assigneeId, assignee: c.assignee, escalationReason: c.escalationReason } : prev));
      },
      [id, setData],
    ),
  );

  useRealtime("ticket:updated", useCallback(() => reload(true), [reload]));

  useRealtime<{ conversationId: string; role: string; typing: boolean; name?: string }>(
    "typing",
    useCallback(
      (t) => {
        if (t.conversationId !== id) return;
        setTyping(t.typing ? (t.role === "AI" ? "AI agent is writing…" : t.role === "CUSTOMER" ? "Customer is typing…" : `${t.name ?? "A teammate"} is typing…`) : null);
      },
      [id],
    ),
  );

  async function patch(body: Partial<{ status: ConversationStatus; assigneeId: string | null; aiActive: boolean }>) {
    setBusy(true);
    try {
      await api(`/api/conversations/${id}`, { method: "PATCH", body });
    } catch (e) {
      toast.danger("Update failed", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !conv) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!conv) return <div className="p-8 text-sm text-muted">Conversation not found.</div>;

  const name = customerName(conv.customer);
  const status = CONVO_STATUS_META[conv.status];

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-separator px-3 py-3 sm:px-6">
          <Link href="/app/inbox" className="-ml-1 rounded-lg p-1.5 text-muted hover:bg-default/60 md:hidden" aria-label="Back to inbox">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 sm:min-w-[200px]">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-semibold">{name}</h2>
              <span
                className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  status.color === "warning" ? "bg-warning/15 text-warning" : status.color === "success" ? "bg-success/15 text-success" : "bg-accent/10 text-accent"
                }`}
              >
                {conv.status === "PENDING" ? "Needs human" : status.label}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted">
              <ChannelIcon channel={conv.channel} /> {CHANNEL_LABEL[conv.channel]}
              {conv.subject ? <span className="truncate">· {conv.subject}</span> : null}
            </div>
          </div>

          <Picker
            label="Assignee"
            hideLabel
            className="w-full sm:w-44"
            value={conv.assigneeId ?? "none"}
            onChange={(v) => patch({ assigneeId: v === "none" ? null : v })}
            options={[{ id: "none", label: "Unassigned" }, ...members.map((m) => ({ id: m.user.id, label: m.user.id === info.user.id ? `${m.user.name} (you)` : m.user.name }))]}
          />

          {conv.aiActive ? (
            <Button size="sm" variant="secondary" onPress={() => patch({ aiActive: false, assigneeId: conv.assigneeId ?? info.user.id })} isDisabled={busy}>
              <UserRoundCheck className="size-4" /> Take over
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onPress={() => patch({ aiActive: true })} isDisabled={busy || !info.settings.aiEnabled}>
              <Bot className="size-4" /> Hand back to AI
            </Button>
          )}

          <Button size="sm" variant="ghost" isIconOnly aria-label="Customer details" className="xl:hidden" onPress={() => setDetailsOpen(true)}>
            <PanelRight className="size-4" />
          </Button>
          {conv.status !== "RESOLVED" ? (
            <Button size="sm" onPress={() => patch({ status: "RESOLVED" })} isDisabled={busy}>
              <CheckCircle2 className="size-4" /> Resolve
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onPress={() => patch({ status: "OPEN" })} isDisabled={busy}>
              <RotateCcw className="size-4" /> Reopen
            </Button>
          )}
        </header>

        {conv.aiActive ? (
          <div className="flex items-center gap-2 border-b border-separator bg-accent/5 px-4 py-2 text-xs text-accent sm:px-6">
            <Bot className="size-3.5" /> The AI agent is handling this conversation. Take over or reply to step in.
          </div>
        ) : null}

        <MessageList messages={conv.messages} customerLabel={name} typing={typing} />
        <Composer conversationId={conv.id} aiActive={conv.aiActive} />
      </div>

      <CustomerPanel conv={conv} onNewTicket={() => setTicketOpen(true)} className="hidden xl:block" />
      {/* Tablet / mobile: details as a slide-over */}
      <div className={`fixed inset-0 z-40 xl:hidden ${detailsOpen ? "" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-black/30 transition-opacity ${detailsOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setDetailsOpen(false)} />
        <div className={`absolute inset-y-0 right-0 w-[min(340px,92vw)] bg-background shadow-2xl transition-transform duration-300 ${detailsOpen ? "translate-x-0" : "translate-x-full"}`}>
          <CustomerPanel conv={conv} onNewTicket={() => { setDetailsOpen(false); setTicketOpen(true); }} className="block h-full" />
        </div>
      </div>
      <TicketFormModal isOpen={ticketOpen} onOpenChange={setTicketOpen} conversationId={conv.id} defaultTitle={conv.subject ?? ""} onCreated={() => reload(true)} />
    </div>
  );
}
