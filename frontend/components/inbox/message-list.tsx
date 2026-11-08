"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileText, ShieldAlert, StickyNote, ThumbsDown, ThumbsUp, Ticket as TicketIcon, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";
import { clockTime, initials } from "@/lib/format";
import type { Message } from "@/lib/types";

/** Agent rating of an AI reply → stored on the message and sent to Langfuse as an "agent_feedback" score. */
function Feedback({ m }: { m: Message }) {
  const [value, setValue] = useState<number | null>(m.metadata?.feedback?.value ?? null);
  async function rate(v: 1 | -1) {
    const prev = value;
    setValue(v);
    try {
      await api(`/api/conversations/${m.conversationId}/messages/${m.id}/feedback`, { method: "POST", body: { value: v } });
    } catch {
      setValue(prev);
    }
  }
  const btn = (v: 1 | -1, label: string, Icon: typeof ThumbsUp) => (
    <button
      type="button"
      onClick={() => rate(v)}
      aria-label={label}
      aria-pressed={value === v}
      title={label}
      className={`rounded p-0.5 hover:bg-default/60 hover:text-foreground ${value === v ? (v === 1 ? "text-success" : "text-danger") : ""}`}
    >
      <Icon className="size-3" />
    </button>
  );
  return (
    <span className="inline-flex items-center gap-0.5">
      {btn(1, "Good reply", ThumbsUp)}
      {btn(-1, "Bad reply", ThumbsDown)}
    </span>
  );
}

function SystemLine({ m }: { m: Message }) {
  const kind = m.metadata?.kind;
  if (kind === "note") {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warning">
          <StickyNote className="size-3.5" /> Internal note · {m.author?.name ?? "Teammate"} · {clockTime(m.createdAt)}
        </div>
        <p className="whitespace-pre-wrap">{m.content}</p>
      </div>
    );
  }
  const Icon = kind === "escalation" ? TriangleAlert : kind === "ticket" ? TicketIcon : null;
  return (
    <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted">
      {Icon ? <Icon className={`size-3.5 ${kind === "escalation" ? "text-warning" : ""}`} /> : null}
      {kind === "ticket" && m.metadata?.ticketId ? (
        <Link href={`/app/tickets/${m.metadata.ticketId}`} className="hover:text-foreground hover:underline">
          {m.content}
        </Link>
      ) : (
        <span>{m.content}</span>
      )}
      <span>· {clockTime(m.createdAt)}</span>
    </div>
  );
}

export function MessageList({ messages, customerLabel, typing }: { messages: Message[]; customerLabel: string; typing: string | null }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  return (
    <div className="zc-scroll flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6 sm:py-6">
      {messages.map((m) => {
        if (m.role === "SYSTEM") return <SystemLine key={m.id} m={m} />;
        const mine = m.role !== "CUSTOMER";
        const isAi = m.role === "AI";
        const sources: { documentName: string; score: number }[] = m.metadata?.sources ?? [];
        const confidence: number | undefined = m.metadata?.confidence;
        return (
          <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
            <div
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                isAi ? "bg-accent text-accent-foreground" : mine ? "bg-foreground text-background" : "bg-default text-foreground"
              }`}
            >
              {isAi ? <Bot className="size-4" /> : initials(mine ? m.author?.name ?? "Agent" : customerLabel)}
            </div>
            <div className={`flex max-w-[85%] flex-col sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  mine ? (isAi ? "rounded-tr-md bg-accent/10 text-foreground" : "rounded-tr-md bg-foreground text-background") : "rounded-tl-md bg-default"
                }`}
              >
                {m.content}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                <span>{isAi ? "AI agent" : mine ? m.author?.name ?? "Agent" : customerLabel}</span>
                <span>{clockTime(m.createdAt)}</span>
                {isAi && confidence !== undefined ? (
                  <span className={confidence < 0.55 ? "text-warning" : ""}>confidence {Math.round(confidence * 100)}%</span>
                ) : null}
                {isAi && m.metadata?.guardrails && (m.metadata.guardrails.inputAction !== "allow" || m.metadata.guardrails.outputAction === "block") ? (
                  <span className="inline-flex items-center gap-0.5 text-warning" title={[...(m.metadata.guardrails.input ?? []), ...(m.metadata.guardrails.output ?? [])].join(", ")}>
                    <ShieldAlert className="size-3" /> guardrail
                  </span>
                ) : null}
                {isAi && m.metadata?.traceId ? <Feedback m={m} /> : null}
                {m.metadata?.deliveryError ? <span className="text-danger">not delivered: {m.metadata.deliveryError}</span> : null}
              </div>
              {isAi && sources.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                  {sources.map((s) => (
                    <span key={s.documentName} className="inline-flex items-center gap-1 rounded-md border border-separator px-1.5 py-0.5 text-[11px] text-muted">
                      <FileText className="size-3" /> {s.documentName}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {typing ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="zc-typing inline-flex gap-1 text-muted">
            <span />
            <span />
            <span />
          </span>
          {typing}
        </div>
      ) : null}
      <div ref={end} />
    </div>
  );
}
