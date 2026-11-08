"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Bot, Code2, Inbox, Plug, Ticket, TriangleAlert } from "lucide-react";
import { PageHeader, SetupNotice } from "@/components/app/page-header";
import { useWorkspace } from "@/components/app/workspace-provider";
import { useFetch } from "@/lib/hooks";

type Stats = { open: number; pending: number; resolved7d: number; openTickets: number; aiMessages7d: number; agentMessages7d: number; escalated7d: number; docs: number; aiShare: number };

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-xl border border-separator p-4 transition-colors hover:bg-default/30 sm:p-5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function OverviewPage() {
  const { info } = useWorkspace();
  const { data: s } = useFetch<Stats>("/api/stats");

  const steps = [
    { done: (s?.docs ?? 0) > 0, title: "Add knowledge", text: "Upload your FAQ, policies and guides.", href: "/app/documents", icon: BookOpen },
    { done: false, title: "Install the chat widget", text: "Paste one script tag into your site.", href: "/app/settings", icon: Code2 },
    { done: false, title: "Connect your tools", text: "HubSpot, Slack and Linear.", href: "/app/connectors", icon: Plug },
  ];

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader title={`Good to see you, ${info.user.name.split(" ")[0]}`} description={`Here's how support is going at ${info.workspace.name}.`} />
      {!info.features.openai ? (
        <SetupNotice>
          The AI agent is off because <b>OPENAI_API_KEY</b> isn&apos;t set in <code>backend/.env</code>. New conversations go straight to your team until it is.
        </SetupNotice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 px-4 py-6 sm:gap-4 sm:px-6 lg:px-8 xl:grid-cols-4">
        <Stat label="Open conversations" value={s?.open ?? "–"} href="/app/inbox" />
        <Stat label="Waiting for a human" value={s?.pending ?? "–"} hint={`${s?.escalated7d ?? 0} escalated this week`} href="/app/inbox" />
        <Stat label="Active tickets" value={s?.openTickets ?? "–"} href="/app/tickets" />
        <Stat label="Replies by AI (7d)" value={s ? `${Math.round(s.aiShare * 100)}%` : "–"} hint={s ? `${s.aiMessages7d} AI · ${s.agentMessages7d} team` : undefined} />
      </div>

      <div className="grid gap-6 px-4 sm:px-6 lg:px-8 pb-10 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-separator p-6">
          <h2 className="font-semibold">Get set up</h2>
          <ul className="mt-4 space-y-2">
            {steps.map((st) => (
              <li key={st.title}>
                <Link href={st.href} className="flex items-center gap-4 rounded-lg p-3 hover:bg-default/40">
                  <span className={`flex size-9 items-center justify-center rounded-lg ${st.done ? "bg-success/15 text-success" : "bg-accent/10 text-accent"}`}>
                    <st.icon className="size-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{st.title}</span>
                    <span className="block text-xs text-muted">{st.text}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <Link href="/app/inbox" className="flex items-center gap-3 rounded-xl border border-separator p-4 hover:bg-default/30">
            <Inbox className="size-5 text-accent" />
            <span className="flex-1 text-sm font-medium">Go to inbox</span>
            <ArrowRight className="size-4 text-muted" />
          </Link>
          <Link href="/app/tickets" className="flex items-center gap-3 rounded-xl border border-separator p-4 hover:bg-default/30">
            <Ticket className="size-5 text-accent" />
            <span className="flex-1 text-sm font-medium">Review tickets</span>
            <ArrowRight className="size-4 text-muted" />
          </Link>
          <div className="rounded-xl bg-default/40 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Bot className="size-4 text-accent" /> How {info.settings.aiName} works
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              It searches your documents, checks HubSpot when account details matter, answers, and opens a ticket when it spots a real problem. If it isn&apos;t sure, it says so and hands the conversation to your team.
            </p>
            {s && s.pending > 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-warning">
                <TriangleAlert className="size-3.5" /> {s.pending} conversation{s.pending > 1 ? "s" : ""} waiting for a human
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
