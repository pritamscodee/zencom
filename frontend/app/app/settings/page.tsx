"use client";

import { useState } from "react";
import { Button, Tabs, toast } from "@heroui/react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useWorkspace } from "@/components/app/workspace-provider";
import { AreaField, Field } from "@/components/ui/field";
import { Picker } from "@/components/ui/pickers";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { WorkspaceSettings } from "@/lib/types";

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-separator py-5 md:grid-cols-[260px_1fr]">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description ? <div className="mt-0.5 text-xs text-muted">{description}</div> : null}
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { info, refresh, isAdmin } = useWorkspace();
  const [s, setS] = useState<WorkspaceSettings>(info.settings);
  const [workspaceName, setWorkspaceName] = useState(info.workspace.name);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-sync the form when workspace settings change upstream (adjusting state during render).
  const [prevSettings, setPrevSettings] = useState(info.settings);
  if (info.settings !== prevSettings) {
    setPrevSettings(info.settings);
    setS(info.settings);
  }
  const set = <K extends keyof WorkspaceSettings>(k: K, v: WorkspaceSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const body: Partial<WorkspaceSettings> = { ...s };
      delete body.id;
      delete body.workspaceId;
      delete body.publicKey;
      await api("/api/workspace/settings", { method: "PATCH", body });
      if (workspaceName !== info.workspace.name) await api("/api/workspace", { method: "PATCH", body: { name: workspaceName } });
      await refresh();
      toast.success("Settings saved");
    } catch (e) {
      toast.danger("Could not save", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function rotateKey() {
    if (!confirm("Rotate the widget key? The old embed snippet will stop working.")) return;
    await api("/api/workspace/rotate-key", { method: "POST" });
    await refresh();
    toast.success("Widget key rotated");
  }

  const f = info.features;

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader
        title="Settings"
        description="Business details, AI agent behaviour and the website chat widget."
        actions={
          isAdmin ? (
            <Button onPress={save} isPending={saving}>
              Save changes
            </Button>
          ) : null
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-12">
        <Tabs className="mt-4">
          <Tabs.ListContainer className="overflow-x-auto">
            <Tabs.List aria-label="Settings sections">
              <Tabs.Tab id="business">
                Business
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="ai">
                AI agent
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="widget">
                Chat widget
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="system">
                System status
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="business">
            <Row title="Workspace name" description="Shown to your team.">
              <Field label="Workspace name" value={workspaceName} onChange={setWorkspaceName} isDisabled={!isAdmin} />
            </Row>
            <Row title="Business" description="The AI uses this to introduce itself and stay on-topic.">
              <div className="space-y-4">
                <Field label="Business name" value={s.businessName ?? ""} onChange={(v) => set("businessName", v || null)} isDisabled={!isAdmin} />
                <AreaField label="What you do" value={s.businessDescription ?? ""} onChange={(v) => set("businessDescription", v || null)} rows={3} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Website" value={s.website ?? ""} onChange={(v) => set("website", v || null)} isDisabled={!isAdmin} />
                  <Field label="Support email" value={s.supportEmail ?? ""} onChange={(v) => set("supportEmail", v || null)} isDisabled={!isAdmin} />
                </div>
              </div>
            </Row>
          </Tabs.Panel>

          <Tabs.Panel id="ai">
            <Row title="AI agent" description="When off, every new conversation goes straight to your team.">
              <Toggle isSelected={s.aiEnabled} onChange={(v) => set("aiEnabled", v)} isDisabled={!isAdmin}>
                <span className="text-sm">AI replies automatically</span>
              </Toggle>
            </Row>
            <Row title="Agent name" description="What customers see as the assistant's name.">
              <Field label="Name" value={s.aiName} onChange={(v) => set("aiName", v)} isDisabled={!isAdmin} />
            </Row>
            <Row title="Instructions" description="Tone, rules and things the AI must or must not do.">
              <AreaField
                label="Custom instructions"
                value={s.aiInstructions ?? ""}
                onChange={(v) => set("aiInstructions", v || null)}
                rows={6}
                placeholder={"Always be upbeat. Never promise refunds — escalate refund requests.\nOffer the 10% WELCOME code to first-time buyers."}
              />
            </Row>
            <Row title="Escalation threshold" description="Replies below this confidence are sent, then handed to a human.">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={s.confidenceThreshold}
                  onChange={(e) => set("confidenceThreshold", Number(e.target.value))}
                  className="w-64 accent-[var(--accent)]"
                  disabled={!isAdmin}
                  aria-label="Confidence threshold"
                />
                <span className="w-12 text-sm tabular-nums">{Math.round(s.confidenceThreshold * 100)}%</span>
              </div>
            </Row>
            <Row title="Tickets" description="Let the AI open (or update) a ticket when it identifies a real issue.">
              <Toggle isSelected={s.autoCreateTickets} onChange={(v) => set("autoCreateTickets", v)} isDisabled={!isAdmin}>
                <span className="text-sm">Create tickets automatically</span>
              </Toggle>
            </Row>
          </Tabs.Panel>

          <Tabs.Panel id="widget">
            <Row title="Install" description="Paste before </body> on every page where the chat should appear.">
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-[#0b0f1a] p-4 pr-12 text-xs leading-relaxed text-white/90">{info.embed.snippet}</pre>
                <button
                  className="absolute right-3 top-3 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(info.embed.snippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  aria-label="Copy snippet"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/widget/${info.settings.publicKey}/preview`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary">
                    <ExternalLink className="size-3.5" /> Preview on a test page
                  </Button>
                </a>
                {isAdmin ? (
                  <Button size="sm" variant="ghost" onPress={rotateKey}>
                    Rotate key
                  </Button>
                ) : null}
              </div>
            </Row>
            <Row title="Appearance">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input type="color" value={s.widgetColor} onChange={(e) => set("widgetColor", e.target.value)} className="size-9 cursor-pointer rounded-md border border-separator" aria-label="Widget color" />
                  <span className="font-mono text-sm">{s.widgetColor}</span>
                </div>
                <Picker
                  label="Position"
                  value={s.widgetPosition}
                  onChange={(v) => set("widgetPosition", (v as "left" | "right") ?? "right")}
                  options={[
                    { id: "right", label: "Bottom right" },
                    { id: "left", label: "Bottom left" },
                  ]}
                />
                <Field label="Greeting" value={s.widgetGreeting} onChange={(v) => set("widgetGreeting", v)} isDisabled={!isAdmin} />
                <Toggle isSelected={s.askForEmail} onChange={(v) => set("askForEmail", v)} isDisabled={!isAdmin}>
                  <span className="text-sm">Ask visitors for their email (optional for them)</span>
                </Toggle>
              </div>
            </Row>
          </Tabs.Panel>

          <Tabs.Panel id="system">
            <Row title="Services" description="Configured in backend/.env. Missing services fall back or disable the related feature.">
              <ul className="space-y-2 text-sm">
                {(
                  [
                    ["openai", "OpenAI — AI agent & embeddings"],
                    ["pinecone", "Pinecone — knowledge base vectors"],
                    ["r2", "Cloudflare R2 — document storage (fallback: local disk)"],
                    ["trigger", "Trigger.dev — background jobs (fallback: in-process)"],
                    ["hubspot", "HubSpot OAuth app"],
                    ["slack", "Slack OAuth app"],
                    ["linear", "Linear OAuth app"],
                  ] as const
                ).map(([k, label]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${f[k] ? "bg-success" : "bg-default-foreground/30"}`} />
                    <span className={f[k] ? "" : "text-muted"}>{label}</span>
                  </li>
                ))}
              </ul>
            </Row>
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
