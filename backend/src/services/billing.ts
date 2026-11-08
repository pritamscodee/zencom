import crypto from "node:crypto";
import Razorpay from "razorpay";
import type { Subscription } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { env, features } from "../lib/env";
import { badRequest, HttpError } from "../lib/http";
import { PLANS, planByRazorpayId, type Plan, type PlanId } from "../lib/plans";

/**
 * Razorpay Subscriptions.
 *
 * Flow: dashboard → POST /api/billing/checkout → we create a Razorpay subscription → frontend opens
 * Razorpay Checkout with subscription_id → customer authorises the mandate → frontend posts the signed
 * response to /api/billing/verify (fast path) → Razorpay also sends subscription.* webhooks (source of truth).
 * Both paths call syncSubscription(), which is idempotent.
 */

let rzp: Razorpay | null = null;
function razorpay() {
  if (!features.billing()) throw new HttpError(503, "Billing is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  rzp ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return rzp;
}

/** Statuses during which the paid plan's limits apply. "pending" = a renewal charge is being retried (grace). */
const ENTITLED = new Set(["active", "authenticated", "pending"]);
/** A subscription that was created but never paid can be reused or discarded. */
const UNPAID = new Set(["created"]);

export async function getSubscription(workspaceId: string) {
  return prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
}

export function effectivePlan(sub: Pick<Subscription, "plan" | "status" | "currentPeriodEnd">): Plan {
  const plan = PLANS[sub.plan as PlanId] ?? PLANS.free;
  if (plan.id === "free") return plan;
  if (ENTITLED.has(sub.status)) return plan;
  // Cancelled at period end: keep paid limits until the period actually ends.
  if (sub.status === "cancelled" && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) return plan;
  return PLANS.free;
}

export async function getPlan(workspaceId: string) {
  return effectivePlan(await getSubscription(workspaceId));
}

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export async function getUsage(workspaceId: string) {
  const [members, invites, aiReplies, documents] = await Promise.all([
    prisma.member.count({ where: { organizationId: workspaceId } }),
    prisma.invitation.count({ where: { organizationId: workspaceId, status: "pending", expiresAt: { gt: new Date() } } }),
    prisma.message.count({ where: { conversation: { workspaceId }, role: "AI", createdAt: { gte: monthStart() } } }),
    prisma.document.count({ where: { workspaceId } }),
  ]);
  return { seats: members + invites, members, pendingInvites: invites, aiRepliesThisMonth: aiReplies, documents };
}

// ── Limits (called from auth hooks, document upload, and the agent) ──

export async function assertSeatAvailable(workspaceId: string) {
  const [plan, usage] = await Promise.all([getPlan(workspaceId), getUsage(workspaceId)]);
  if (usage.seats >= plan.limits.seats) {
    throw new HttpError(402, `Your ${plan.name} plan includes ${plan.limits.seats} seats (members + pending invites). Upgrade in Billing to add more.`);
  }
}

export async function assertDocumentSlots(workspaceId: string, adding: number) {
  const [plan, usage] = await Promise.all([getPlan(workspaceId), getUsage(workspaceId)]);
  if (usage.documents + adding > plan.limits.documents) {
    throw new HttpError(402, `Your ${plan.name} plan includes ${plan.limits.documents} documents. Remove some or upgrade in Billing.`);
  }
}

export async function aiQuotaRemaining(workspaceId: string) {
  const plan = await getPlan(workspaceId);
  const used = await prisma.message.count({ where: { conversation: { workspaceId }, role: "AI", createdAt: { gte: monthStart() } } });
  return { plan, used, remaining: Math.max(0, plan.limits.aiRepliesPerMonth - used) };
}

// ── Checkout ──

const planAmountCache = new Map<string, { amount: number; currency: string; at: number }>();

/** Real price from Razorpay (cached 1h); falls back to the configured display price. */
export async function planPrice(plan: Plan) {
  const id = plan.razorpayPlanId();
  if (!id || !features.billing()) return { amount: plan.pricePaise, currency: "INR" };
  const hit = planAmountCache.get(id);
  if (hit && Date.now() - hit.at < 3600_000) return hit;
  try {
    const p = await razorpay().plans.fetch(id);
    const v = { amount: Number(p.item.amount), currency: p.item.currency, at: Date.now() };
    planAmountCache.set(id, v);
    return v;
  } catch {
    return { amount: plan.pricePaise, currency: "INR" };
  }
}

export async function createCheckout(workspaceId: string, planId: PlanId, customer: { name: string; email: string }) {
  const plan = PLANS[planId];
  if (!plan || plan.id === "free") throw badRequest("Choose a paid plan");
  const razorpayPlanId = plan.razorpayPlanId();
  if (!razorpayPlanId) throw new HttpError(503, `RAZORPAY_PLAN_${planId.toUpperCase()} is not configured`);

  const sub = await getSubscription(workspaceId);

  // Already paying: switch plan on the existing mandate instead of creating a second subscription.
  if (sub.razorpaySubscriptionId && ENTITLED.has(sub.status) && sub.plan !== "free") {
    if (sub.plan === planId) throw badRequest(`You're already on ${plan.name}`);
    const updated = await razorpay().subscriptions.update(sub.razorpaySubscriptionId, {
      plan_id: razorpayPlanId,
      schedule_change_at: "now",
      customer_notify: 1,
    } as any);
    await syncSubscription(updated as any);
    return { mode: "updated" as const, subscription: await getSubscription(workspaceId) };
  }

  // Unpaid subscription for the same plan from an abandoned checkout: reuse it.
  if (sub.razorpaySubscriptionId && UNPAID.has(sub.status) && sub.razorpayPlanId === razorpayPlanId) {
    return { mode: "checkout" as const, keyId: env.RAZORPAY_KEY_ID, subscriptionId: sub.razorpaySubscriptionId, plan: planId, prefill: customer };
  }
  if (sub.razorpaySubscriptionId && UNPAID.has(sub.status)) {
    await razorpay().subscriptions.cancel(sub.razorpaySubscriptionId, false).catch(() => {});
  }

  const created = await razorpay().subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: 120, // monthly for up to 10 years; customer can cancel any time
    customer_notify: 1,
    quantity: 1,
    notes: { workspaceId, plan: planId },
  });
  // status "created" is not entitled, so the workspace stays on Free limits until the mandate is authorised.
  await prisma.subscription.update({
    where: { workspaceId },
    data: { razorpaySubscriptionId: created.id, razorpayPlanId, status: "created", shortUrl: created.short_url ?? null, cancelAtPeriodEnd: false },
  });
  return { mode: "checkout" as const, keyId: env.RAZORPAY_KEY_ID, subscriptionId: created.id, plan: planId, prefill: customer };
}

/** Verifies the Checkout handler response: HMAC_SHA256(payment_id|subscription_id, key_secret). */
export async function verifyCheckout(workspaceId: string, body: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${body.razorpay_payment_id}|${body.razorpay_subscription_id}`)
    .digest("hex");
  if (!safeEqual(expected, body.razorpay_signature)) throw badRequest("Invalid payment signature");
  const sub = await getSubscription(workspaceId);
  if (sub.razorpaySubscriptionId !== body.razorpay_subscription_id) throw badRequest("Subscription does not belong to this workspace");
  const remote = await razorpay().subscriptions.fetch(body.razorpay_subscription_id);
  await syncSubscription(remote as any, { paymentId: body.razorpay_payment_id });
  return getSubscription(workspaceId);
}

export async function cancelSubscription(workspaceId: string, atPeriodEnd = true) {
  const sub = await getSubscription(workspaceId);
  if (!sub.razorpaySubscriptionId || sub.plan === "free") throw badRequest("No active subscription");
  const remote = await razorpay().subscriptions.cancel(sub.razorpaySubscriptionId, atPeriodEnd);
  await syncSubscription(remote as any);
  if (atPeriodEnd) await prisma.subscription.update({ where: { workspaceId }, data: { cancelAtPeriodEnd: true } });
  return getSubscription(workspaceId);
}

type RemoteSubscription = {
  id: string;
  plan_id: string;
  status: string;
  customer_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  short_url?: string | null;
  notes?: Record<string, string> | string[];
};

/** Idempotently mirror a Razorpay subscription entity onto our row. */
export async function syncSubscription(remote: RemoteSubscription, extra: { paymentId?: string } = {}) {
  const notes = Array.isArray(remote.notes) ? {} : (remote.notes ?? {});
  const row =
    (await prisma.subscription.findUnique({ where: { razorpaySubscriptionId: remote.id } })) ??
    (notes.workspaceId ? await prisma.subscription.findUnique({ where: { workspaceId: notes.workspaceId } }) : null);
  if (!row) return null;
  // Ignore events for an older subscription that has since been replaced.
  if (row.razorpaySubscriptionId && row.razorpaySubscriptionId !== remote.id) return row;

  const plan = planByRazorpayId(remote.plan_id);
  const ts = (s?: number | null) => (s ? new Date(s * 1000) : null);
  const terminal = ["completed", "expired"].includes(remote.status);
  return prisma.subscription.update({
    where: { id: row.id },
    data: {
      razorpaySubscriptionId: remote.id,
      razorpayPlanId: remote.plan_id,
      razorpayCustomerId: remote.customer_id ?? row.razorpayCustomerId,
      status: remote.status,
      plan: terminal ? "free" : (plan?.id ?? row.plan),
      shortUrl: remote.short_url ?? row.shortUrl,
      currentPeriodStart: ts(remote.current_start) ?? row.currentPeriodStart,
      currentPeriodEnd: ts(remote.current_end) ?? row.currentPeriodEnd,
      cancelAtPeriodEnd: remote.status === "cancelled" ? row.cancelAtPeriodEnd : remote.status === "active" ? false : row.cancelAtPeriodEnd,
      ...(extra.paymentId ? { lastPaymentId: extra.paymentId, lastPaymentAt: new Date() } : {}),
    },
  });
}

// ── Webhooks ──

export function verifyWebhookSignature(raw: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  return safeEqual(expected, signature);
}

export async function handleWebhook(eventId: string, event: any) {
  // Idempotency: Razorpay retries deliveries; process each event id once.
  const exists = await prisma.billingEvent.findUnique({ where: { id: eventId } });
  if (exists) return { duplicate: true };

  const remote: RemoteSubscription | undefined = event?.payload?.subscription?.entity;
  const payment = event?.payload?.payment?.entity;
  let workspaceId: string | null = null;
  if (remote && String(event.event).startsWith("subscription.")) {
    const row = await syncSubscription(remote, { paymentId: event.event === "subscription.charged" ? payment?.id : undefined });
    workspaceId = row?.workspaceId ?? null;
  }
  await prisma.billingEvent.create({ data: { id: eventId, type: String(event.event), workspaceId, payload: event } });
  return { duplicate: false };
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
