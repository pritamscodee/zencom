"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { Building2, Mail, Phone, Plus, RefreshCw, Ticket as TicketIcon } from "lucide-react";
import { ChannelIcon, CHANNEL_LABEL } from "@/components/app/channel-icon";
import { useWorkspace } from "@/components/app/workspace-provider";
import { api } from "@/lib/api";
import { CONVO_STATUS_META, customerName, dateTime, PRIORITY_META, TICKET_STATUS_META, timeAgo } from "@/lib/format";
import type { ConversationDetail } from "@/lib/types";

type CrmCompany = { hs_object_id?: string; name?: string; domain?: string };
type CrmContact = { firstname?: string; lastname?: string; email?: string; jobtitle?: string; lifecyclestage?: string; companies?: CrmCompany[] };
type CrmResult = { connected: boolean; contacts: CrmContact[] };

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-b border-separator px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CustomerPanel({ conv, onNewTicket, className = "" }: { conv: ConversationDetail; onNewTicket: () => void; className?: string }) {
  const { info } = useWorkspace();
  const c = conv.customer;
  const [crm, setCrm] = useState<CrmResult | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

  async function lookup() {
    setCrmLoading(true);
    try {
      setCrm(await api<CrmResult>("/api/integrations/hubspot/lookup", { query: { email: c.email, q: c.email ? undefined : c.name ?? c.phone } }));
    } catch {
      setCrm({ connected: false, contacts: [] });
    } finally {
      setCrmLoading(false);
    }
  }

  const contact = crm?.contacts[0];

  return (
    <aside className={`zc-scroll w-full shrink-0 overflow-y-auto border-l border-separator xl:w-80 ${className}`}>
      <div className="px-5 py-5">
        <div className="text-base font-semibold">{customerName(c)}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <ChannelIcon channel={conv.channel} /> {CHANNEL_LABEL[conv.channel]} · first seen {timeAgo(c.createdAt)} ago
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted" /> <span className="truncate">{c.email ?? <span className="text-muted">No email yet</span>}</span>
          </div>
          {c.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted" /> {c.phone}
            </div>
          ) : null}
          {c.metadata?.referrer ? <div className="truncate text-xs text-muted">From {String(c.metadata.referrer)}</div> : null}
        </dl>
      </div>

      {conv.escalationReason && conv.status === "PENDING" ? (
        <div className="mx-5 mb-4 rounded-lg bg-warning/10 px-3 py-2.5 text-xs">
          <div className="font-medium text-warning">Why it was escalated</div>
          <div className="mt-0.5 text-foreground/80">{conv.escalationReason}</div>
        </div>
      ) : null}

      <Section
        title="CRM"
        action={
          info.features.hubspot ? (
            <button onClick={lookup} className="text-muted hover:text-foreground" aria-label="Look up in HubSpot">
              {crmLoading ? <Spinner size="sm" /> : <RefreshCw className="size-3.5" />}
            </button>
          ) : null
        }
      >
        {!crm ? (
          <Button size="sm" variant="secondary" className="w-full" onPress={lookup} isPending={crmLoading}>
            Look up in HubSpot
          </Button>
        ) : !crm.connected ? (
          <p className="text-xs text-muted">
            HubSpot isn&apos;t connected.{" "}
            <Link href="/app/connectors" className="text-accent">
              Connect it
            </Link>{" "}
            so the AI and your team can see customer context.
          </p>
        ) : !contact ? (
          <p className="text-xs text-muted">No matching HubSpot contact.</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            <div className="font-medium">
              {[contact.firstname, contact.lastname].filter(Boolean).join(" ") || contact.email}
            </div>
            {contact.jobtitle ? <div className="text-xs text-muted">{contact.jobtitle}</div> : null}
            {contact.lifecyclestage ? (
              <Chip size="sm" variant="soft">
                {contact.lifecyclestage}
              </Chip>
            ) : null}
            {(contact.companies ?? []).map((co) => (
              <div key={co.hs_object_id ?? co.name} className="flex items-center gap-1.5 text-xs text-muted">
                <Building2 className="size-3.5" /> {co.name} {co.domain ? `· ${co.domain}` : ""}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Tickets"
        action={
          <button onClick={onNewTicket} className="text-muted hover:text-foreground" aria-label="New ticket">
            <Plus className="size-4" />
          </button>
        }
      >
        {conv.tickets.length === 0 ? (
          <p className="text-xs text-muted">No tickets. The AI opens one automatically when it spots a real issue.</p>
        ) : (
          <ul className="space-y-2">
            {conv.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/app/tickets/${t.id}`} className="block rounded-lg border border-separator p-2.5 hover:bg-default/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <TicketIcon className="size-3.5" />#{t.number}
                    <Chip size="sm" color={TICKET_STATUS_META[t.status].color} variant="soft" className="ml-auto">
                      {TICKET_STATUS_META[t.status].label}
                    </Chip>
                  </div>
                  <div className="mt-1 text-sm font-medium">{t.title}</div>
                  <div className="mt-1 text-xs text-muted">{PRIORITY_META[t.priority].label} priority</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Previous conversations">
        {conv.otherConversations.length === 0 ? (
          <p className="text-xs text-muted">This is their first conversation.</p>
        ) : (
          <ul className="space-y-1">
            {conv.otherConversations.map((o) => (
              <li key={o.id}>
                <Link href={`/app/inbox/${o.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-default/50">
                  <ChannelIcon channel={o.channel} />
                  <span className="flex-1 truncate">{o.subject ?? "Conversation"}</span>
                  <span className="text-[11px] text-muted">{CONVO_STATUS_META[o.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="px-5 py-4 text-[11px] text-muted">Started {dateTime(conv.createdAt)}</div>
    </aside>
  );
}
