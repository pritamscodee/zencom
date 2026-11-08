import { env } from "./env";

export type PlanId = "free" | "starter" | "growth";

export type Plan = {
  id: PlanId;
  name: string;
  /** Display price in paise. Razorpay plan amount is the source of truth when available. */
  pricePaise: number;
  razorpayPlanId: () => string;
  limits: { seats: number; aiRepliesPerMonth: number; documents: number };
  highlights: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    pricePaise: 0,
    razorpayPlanId: () => "",
    limits: { seats: 2, aiRepliesPerMonth: 50, documents: 5 },
    highlights: ["2 seats", "50 AI replies / month", "5 knowledge documents", "Web chat widget"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    pricePaise: 399_00,
    razorpayPlanId: () => env.RAZORPAY_PLAN_STARTER,
    limits: { seats: 3, aiRepliesPerMonth: 500, documents: 50 },
    highlights: ["3 seats", "500 AI replies / month", "50 knowledge documents", "HubSpot, Slack, Linear"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    pricePaise: 699_00,
    razorpayPlanId: () => env.RAZORPAY_PLAN_GROWTH,
    limits: { seats: 10, aiRepliesPerMonth: 1_500, documents: 200 },
    highlights: ["10 seats", "1,500 AI replies / month", "200 knowledge documents", "Priority support"],
  },
};

export const planByRazorpayId = (razorpayPlanId: string) =>
  Object.values(PLANS).find((p) => p.razorpayPlanId() && p.razorpayPlanId() === razorpayPlanId) ?? null;
