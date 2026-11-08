import { Router } from "express";
import { z } from "zod";
import { features } from "../lib/env";
import { PLANS } from "../lib/plans";
import { ADMIN, ctx, requireRole } from "../middleware/auth";
import {
  cancelSubscription,
  createCheckout,
  effectivePlan,
  getSubscription,
  getUsage,
  planPrice,
  verifyCheckout,
} from "../services/billing";

export const billingRouter = Router();

billingRouter.get("/billing", async (req, res) => {
  const { workspaceId } = ctx(req);
  const [subscription, usage] = await Promise.all([getSubscription(workspaceId), getUsage(workspaceId)]);
  const current = effectivePlan(subscription);
  const plans = await Promise.all(
    Object.values(PLANS).map(async (p) => ({
      id: p.id,
      name: p.name,
      limits: p.limits,
      highlights: p.highlights,
      price: await planPrice(p),
      available: p.id === "free" || Boolean(p.razorpayPlanId()),
    })),
  );
  res.json({
    enabled: features.billing(),
    currentPlan: current.id,
    limits: current.limits,
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      lastPaymentAt: subscription.lastPaymentAt,
    },
    usage,
    plans,
  });
});

billingRouter.post("/billing/checkout", requireRole("owner"), async (req, res) => {
  const { workspaceId, user } = ctx(req);
  const { plan } = z.object({ plan: z.enum(["starter", "growth"]) }).parse(req.body);
  res.json(await createCheckout(workspaceId, plan, { name: user.name, email: user.email }));
});

billingRouter.post("/billing/verify", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const body = z
    .object({ razorpay_payment_id: z.string().min(1), razorpay_subscription_id: z.string().min(1), razorpay_signature: z.string().min(1) })
    .parse(req.body);
  res.json(await verifyCheckout(workspaceId, body));
});

billingRouter.post("/billing/cancel", requireRole("owner"), async (req, res) => {
  const { workspaceId } = ctx(req);
  const { atPeriodEnd } = z.object({ atPeriodEnd: z.boolean().default(true) }).parse(req.body ?? {});
  res.json(await cancelSubscription(workspaceId, atPeriodEnd));
});
