"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Chip, toast } from "@heroui/react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useWorkspace } from "@/components/app/workspace-provider";
import { api } from "@/lib/api";
import { dateTime, errorMessage } from "@/lib/format";
import type { BillingInfo, PlanId } from "@/lib/types";

type RazorpayFailure = { error?: { description?: string } };
type CheckoutResponse =
  | { mode: "updated" }
  | { mode: "checkout"; keyId: string; subscriptionId: string; plan: PlanId; prefill?: { name?: string; email?: string } };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: RazorpayFailure) => void) => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(s);
  });
}

const formatPrice = (p: { amount: number; currency: string }) =>
  p.amount === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency: p.currency, maximumFractionDigits: 0 }).format(p.amount / 100);

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  authenticated: "Starting",
  created: "Awaiting payment",
  pending: "Payment retrying",
  halted: "Payment failed",
  cancelled: "Cancelled",
  completed: "Ended",
  expired: "Expired",
  paused: "Paused",
};

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          <b className="font-semibold">{used.toLocaleString("en-IN")}</b> <span className="text-muted">/ {limit.toLocaleString("en-IN")}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-default" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { info } = useWorkspace();
  const [data, setData] = useState<BillingInfo | null>(null);
  const [busy, setBusy] = useState<PlanId | "cancel" | null>(null);
  const isOwner = info.role === "owner";

  const load = useCallback(() => api<BillingInfo>("/api/billing").then(setData), []);
  useEffect(() => {
    load().catch((e) => toast.danger("Could not load billing", { description: errorMessage(e) }));
  }, [load]);

  async function choose(plan: PlanId) {
    setBusy(plan);
    try {
      const res = await api<CheckoutResponse>("/api/billing/checkout", { method: "POST", body: { plan } });
      if (res.mode === "updated") {
        toast.success("Plan changed", { description: "Your new limits apply now. Razorpay adjusts the next charge." });
        await load();
        return;
      }
      await loadCheckout();
      const rzp = new window.Razorpay!({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: "Zencom",
        description: `${data?.plans.find((p) => p.id === plan)?.name} plan · ${info.workspace.name}`,
        prefill: { name: res.prefill?.name, email: res.prefill?.email },
        theme: { color: "#0052f2" },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            await api("/api/billing/verify", { method: "POST", body: response });
            toast.success("You're subscribed", { description: "Thanks! Your new plan is active." });
          } catch (e) {
            toast.danger("Payment received, verification pending", { description: `${errorMessage(e)}. It will update automatically shortly.` });
          }
          await load();
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.on("payment.failed", (r) => toast.danger("Payment failed", { description: r?.error?.description ?? "Try another payment method." }));
      rzp.open();
    } catch (e) {
      toast.danger("Could not start checkout", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm("Cancel your subscription? You keep your current plan until the end of the billing period.")) return;
    setBusy("cancel");
    try {
      await api("/api/billing/cancel", { method: "POST", body: { atPeriodEnd: true } });
      toast.success("Subscription cancelled", { description: "It won't renew. Paid limits stay until the period ends." });
      await load();
    } catch (e) {
      toast.danger("Could not cancel", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="p-8 text-sm text-muted">Loading billing…</div>;

  const current = data.plans.find((p) => p.id === data.currentPlan)!;
  const sub = data.subscription;
  const paid = data.currentPlan !== "free";

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader title="Billing" description="Your plan, usage this month, and payments through Razorpay." />
      <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {!data.enabled ? (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
            Billing isn&apos;t configured on this server yet. Set <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and the plan ids in the backend <code>.env</code>.
          </div>
        ) : null}

        <section className="grid gap-6 rounded-xl border border-separator p-5 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="text-xs text-muted">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight">{current.name}</span>
              {paid ? (
                <Chip size="sm" variant="soft" color={sub.status === "active" ? "success" : "warning"}>
                  {sub.cancelAtPeriodEnd ? "Cancels at period end" : STATUS_LABEL[sub.status] ?? sub.status}
                </Chip>
              ) : null}
            </div>
            <div className="mt-1 text-sm text-muted">
              {paid ? `${formatPrice(current.price)} / month` : "No payment method on file"}
              {paid && sub.currentPeriodEnd ? ` · ${sub.cancelAtPeriodEnd ? "ends" : "renews"} ${dateTime(sub.currentPeriodEnd)}` : null}
            </div>
            {sub.status === "halted" ? (
              <p className="mt-3 text-sm text-danger">Your last renewal payment failed, so the workspace is on Free limits. Choose a plan again to resume.</p>
            ) : null}
            {paid && isOwner && !sub.cancelAtPeriodEnd ? (
              <Button className="mt-4" size="sm" variant="ghost" isPending={busy === "cancel"} onPress={cancel}>
                Cancel subscription
              </Button>
            ) : null}
          </div>
          <div className="space-y-4">
            <Meter label="AI replies this month" used={data.usage.aiRepliesThisMonth} limit={data.limits.aiRepliesPerMonth} />
            <Meter label="Seats (members + pending invites)" used={data.usage.seats} limit={data.limits.seats} />
            <Meter label="Knowledge documents" used={data.usage.documents} limit={data.limits.documents} />
            <p className="text-xs text-muted">When AI replies run out, new conversations go straight to your team until the month resets.</p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Plans</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {data.plans.map((p) => {
              const isCurrent = p.id === data.currentPlan;
              return (
                <div key={p.id} className={`flex flex-col rounded-xl border p-5 ${isCurrent ? "border-accent ring-1 ring-accent" : "border-separator"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    {isCurrent ? (
                      <Chip size="sm" variant="soft" color="accent">
                        Current
                      </Chip>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-semibold tracking-tight">{formatPrice(p.price)}</span>
                    {p.price.amount > 0 ? <span className="text-sm text-muted"> / month</span> : null}
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {h}
                      </li>
                    ))}
                  </ul>
                  {p.id !== "free" ? (
                    <Button
                      className="mt-5"
                      variant={isCurrent ? "secondary" : "primary"}
                      isDisabled={isCurrent || !isOwner || !data.enabled || !p.available || busy !== null}
                      isPending={busy === p.id}
                      onPress={() => choose(p.id)}
                    >
                      {isCurrent ? "Current plan" : paid ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!isOwner ? <p className="mt-3 text-xs text-muted">Only the workspace owner can change the plan.</p> : null}
          <p className="mt-3 text-xs text-muted">Prices include applicable taxes. Payments are processed by Razorpay. Cancel anytime; you keep paid limits until the period ends.</p>
        </section>
      </div>
    </div>
  );
}
