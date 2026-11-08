"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Chip, Dropdown, Label, Modal, Spinner, toast } from "@heroui/react";
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, MessagesSquare, Send } from "lucide-react";
import { useRealtime, useWorkspace } from "@/components/app/workspace-provider";
import { AreaField } from "@/components/ui/field";
import { Picker } from "@/components/ui/pickers";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { customerName, dateTime, errorMessage, PRIORITY_META, TICKET_STATUS_META } from "@/lib/format";
import type { TicketDetail } from "@/lib/types";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { members } = useWorkspace();
  const { data: t, loading, reload } = useFetch<TicketDetail>(`/api/tickets/${id}`);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useRealtime<{ id: string }>("ticket:updated", useCallback((x) => x.id === id && reload(true), [id, reload]));
  useEffect(() => {
    if (t) setResolution(t.proposedResolution ?? "");
  }, [t?.proposedResolution]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(body: Record<string, unknown>) {
    try {
      await api(`/api/tickets/${id}`, { method: "PATCH", body });
      reload(true);
    } catch (e) {
      toast.danger("Update failed", { description: errorMessage(e) });
    }
  }

  async function resolve() {
    setBusy("resolve");
    try {
      await api(`/api/tickets/${id}/resolve`, {
        method: "POST",
        body: { sendResolution: sendToCustomer && Boolean(resolution.trim()) && Boolean(t?.conversationId), resolution: resolution.trim() || undefined },
      });
      toast.success("Ticket resolved");
      setResolveOpen(false);
      reload(true);
    } catch (e) {
      toast.danger("Could not resolve", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function sendTo(provider: "SLACK" | "LINEAR") {
    setBusy(provider);
    try {
      const r = await api<{ queued?: boolean }>(`/api/tickets/${id}/send`, { method: "POST", body: { provider } });
      toast.success(r?.queued ? `Queued for ${provider === "SLACK" ? "Slack" : "Linear"}` : `Sent to ${provider === "SLACK" ? "Slack" : "Linear"}`);
      reload(true);
    } catch (e) {
      toast.danger("Send failed", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  if (loading && !t) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!t) return <div className="p-8 text-sm text-muted">Ticket not found.</div>;

  const done = t.status === "RESOLVED" || t.status === "CLOSED";

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-7">
        <Link href="/app/tickets" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Tickets
        </Link>

        <div className="mt-4 flex flex-wrap items-start gap-3 sm:gap-4">
          <div className="w-full min-w-0 sm:w-auto sm:flex-1">
            <div className="flex items-center gap-2 text-sm text-muted">
              #{t.number} · {t.category.replace("_", " ")}
              {t.createdByAi ? (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Bot className="size-3.5" /> Created by AI
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{t.title}</h1>
          </div>

          {/* Primary action 1: Approve / Resolve */}
          <Button onPress={() => setResolveOpen(true)} isDisabled={done}>
            <CheckCircle2 className="size-4" /> {t.proposedResolution ? "Approve & resolve" : "Resolve"}
          </Button>

          {/* Primary action 2: Send to */}
          <Dropdown>
            <Button variant="secondary" isPending={busy === "SLACK" || busy === "LINEAR"}>
              <Send className="size-4" /> Send to
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(k) => sendTo(k as "SLACK" | "LINEAR")} disabledKeys={[...(t.destinations.slack ? [] : ["SLACK"]), ...(t.destinations.linear ? [] : ["LINEAR"])]}>
                <Dropdown.Item id="SLACK" textValue="Slack">
                  <Label>Slack {t.destinations.slack ? "" : "(not connected)"}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="LINEAR" textValue="Linear">
                  <Label>Linear {t.destinations.linear ? "" : "(not connected)"}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Description</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p>
            </section>

            {t.proposedResolution ? (
              <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                  <Bot className="size-3.5" /> Proposed resolution
                </h2>
                <p className="whitespace-pre-wrap text-sm">{t.proposedResolution}</p>
              </section>
            ) : null}

            {t.externalLinks?.slack || t.externalLinks?.linear ? (
              <section className="flex flex-wrap gap-2">
                {t.externalLinks.linear ? (
                  <a href={t.externalLinks.linear.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-separator px-3 py-1.5 text-sm hover:bg-default/50">
                    Linear {t.externalLinks.linear.identifier} <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
                {t.externalLinks.slack ? (
                  <a href={t.externalLinks.slack.url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-separator px-3 py-1.5 text-sm hover:bg-default/50">
                    Slack message <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Activity</h2>
              <ol className="relative space-y-4 border-l border-separator pl-5">
                {t.activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${a.type === "send_failed" ? "bg-danger" : a.type === "resolved" ? "bg-success" : "bg-accent"}`} />
                    <div className="text-sm">{a.message}</div>
                    <div className="text-xs text-muted">
                      {a.actor?.name ?? "Zencom AI"} · {dateTime(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-4">
            <Picker
              label="Status"
              value={t.status}
              onChange={(v) => v && update({ status: v })}
              options={(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((s) => ({ id: s, label: TICKET_STATUS_META[s].label }))}
            />
            <Picker
              label="Priority"
              value={t.priority}
              onChange={(v) => v && update({ priority: v })}
              options={(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => ({ id: p, label: PRIORITY_META[p].label }))}
            />
            <Picker
              label="Assignee"
              value={t.assigneeId ?? "none"}
              onChange={(v) => update({ assigneeId: v === "none" ? null : v })}
              options={[{ id: "none", label: "Unassigned" }, ...members.map((m) => ({ id: m.user.id, label: m.user.name }))]}
            />
            <div className="rounded-xl border border-separator p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Customer</div>
              <div className="mt-1.5 font-medium">{customerName(t.customer)}</div>
              {t.customer?.email ? <div className="text-xs text-muted">{t.customer.email}</div> : null}
              {t.conversationId ? (
                <Link href={`/app/inbox/${t.conversationId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
                  <MessagesSquare className="size-4" /> Open conversation
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Chip size="sm" variant="soft" color={TICKET_STATUS_META[t.status].color}>
                {TICKET_STATUS_META[t.status].label}
              </Chip>
              <span>Created {dateTime(t.createdAt)}</span>
              {t.resolvedAt ? <span>Resolved {dateTime(t.resolvedAt)}</span> : null}
            </div>
          </aside>
        </div>
      </div>

      <Modal.Backdrop isOpen={resolveOpen} onOpenChange={setResolveOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t.proposedResolution ? "Approve resolution" : "Resolve ticket"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <AreaField label="Resolution" value={resolution} onChange={setResolution} rows={5} placeholder="Explain how the issue was resolved…" />
              {t.conversationId ? (
                <Toggle isSelected={sendToCustomer} onChange={setSendToCustomer}>
                  <span className="text-sm">Send this resolution to the customer</span>
                </Toggle>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" slot="close">
                Cancel
              </Button>
              <Button onPress={resolve} isPending={busy === "resolve"}>
                Resolve
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
