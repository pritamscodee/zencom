"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Chip, toast } from "@heroui/react";
import { PageHeader } from "@/components/app/page-header";
import { BRAND_LOGOS } from "@/components/brand/integration-logos";
import { useWorkspace } from "@/components/app/workspace-provider";
import { Picker } from "@/components/ui/pickers";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { errorMessage } from "@/lib/format";
import type { Integration } from "@/lib/types";

type Res = { items: Integration[]; available: Record<"HUBSPOT" | "SLACK" | "LINEAR", boolean> };
type Provider = Integration["provider"];

const META: Record<Provider, { name: string; description: string }> = {
  HUBSPOT: { name: "HubSpot", description: "Let the AI and your team look up contacts and companies. Data stays in HubSpot." },
  SLACK: { name: "Slack", description: "Send tickets and issue alerts to a channel your team watches." },
  LINEAR: { name: "Linear", description: "Turn support tickets into engineering issues with one click." },
};

function DestinationPicker({ provider, integration, onSaved }: { provider: "SLACK" | "LINEAR"; integration: Integration; onSaved: () => void }) {
  const path = provider === "SLACK" ? "/api/integrations/slack/channels" : "/api/integrations/linear/teams";
  const { data, error } = useFetch<{ items: { id: string; name: string }[] }>(path);
  const current = provider === "SLACK" ? integration.config.channelId : integration.config.teamId;

  async function save(id: string | null) {
    if (!id) return;
    const item = data?.items.find((i) => i.id === id);
    const body = provider === "SLACK" ? { channelId: id, channelName: item?.name } : { teamId: id, teamName: item?.name };
    try {
      await api(`/api/integrations/${provider.toLowerCase()}/config`, { method: "PATCH", body });
      toast.success("Default destination saved");
      onSaved();
    } catch (e) {
      toast.danger("Could not save", { description: errorMessage(e) });
    }
  }

  if (error) return <p className="text-xs text-danger">{error.message}</p>;
  return (
    <Picker
      label={provider === "SLACK" ? "Default channel" : "Default team"}
      value={current ?? null}
      onChange={save}
      placeholder={data ? "Choose…" : "Loading…"}
      options={(data?.items ?? []).map((i) => ({ id: i.id, label: provider === "SLACK" ? `#${i.name}` : i.name }))}
    />
  );
}

function Connectors() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin } = useWorkspace();
  const { data, reload } = useFetch<Res>("/api/integrations");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`${connected[0]!.toUpperCase()}${connected.slice(1)} connected`);
    if (error) toast.danger("Connection failed", { description: error });
    if (connected || error) router.replace("/app/connectors");
  }, [params, router]);

  const byProvider = new Map(data?.items.map((i) => [i.provider, i]) ?? []);

  async function connect(p: Provider) {
    setBusy(p);
    try {
      const { url } = await api<{ url: string }>(`/api/integrations/${p.toLowerCase()}/authorize`);
      window.location.href = url;
    } catch (e) {
      toast.danger("Can't start connection", { description: errorMessage(e) });
      setBusy(null);
    }
  }

  async function disconnect(p: Provider) {
    if (!confirm(`Disconnect ${META[p].name}?`)) return;
    await api(`/api/integrations/${p.toLowerCase()}`, { method: "DELETE" });
    toast(`${META[p].name} disconnected`);
    reload(true);
  }

  async function test(p: Provider) {
    setBusy(`test-${p}`);
    try {
      await api(`/api/integrations/${p.toLowerCase()}/test`, { method: "POST" });
      toast.success(`${META[p].name} connection works`);
    } catch (e) {
      toast.danger(`${META[p].name} test failed`, { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader title="Connectors" description="Connect the tools your team already uses. Credentials are encrypted and scoped to this workspace." />
      <div className="grid gap-4 px-4 sm:px-6 lg:px-8 py-6 lg:grid-cols-2">
        {(Object.keys(META) as Provider[]).map((p) => {
          const integ = byProvider.get(p);
          const meta = META[p];
          const BrandLogo = BRAND_LOGOS[p];
          const configured = data?.available[p];
          return (
            <div key={p} className="flex flex-col rounded-xl border border-separator p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-separator bg-white">
                  <BrandLogo className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{meta.name}</h3>
                    {integ ? (
                      <Chip size="sm" color="success" variant="soft">
                        Connected
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{meta.description}</p>
                  {integ?.externalAccountName ? <p className="mt-1 text-xs text-muted">Account: {integ.externalAccountName}</p> : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {integ && (p === "SLACK" || p === "LINEAR") ? <DestinationPicker provider={p} integration={integ} onSaved={() => reload(true)} /> : null}
                {!configured && !integ ? (
                  <p className="text-xs text-warning">
                    Add {p}_CLIENT_ID and {p}_CLIENT_SECRET to backend/.env to enable OAuth.
                  </p>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {!isAdmin ? (
                  <span className="text-xs text-muted">Only admins can manage connectors.</span>
                ) : integ ? (
                  <>
                    <Button size="sm" variant="secondary" onPress={() => test(p)} isPending={busy === `test-${p}`}>
                      Test
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => connect(p)}>
                      Reconnect
                    </Button>
                    <Button size="sm" variant="danger-soft" onPress={() => disconnect(p)}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onPress={() => connect(p)} isPending={busy === p} isDisabled={!configured}>
                    Connect {meta.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  return (
    <Suspense>
      <Connectors />
    </Suspense>
  );
}
