import express, { Router } from "express";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { receiveCustomerMessage } from "../services/conversations";
import { handleWebhook, verifyWebhookSignature } from "../services/billing";

export const webhooksRouter = Router();

/** Razorpay subscription webhooks. Signature = HMAC_SHA256(raw body, RAZORPAY_WEBHOOK_SECRET). */
webhooksRouter.post("/webhooks/razorpay", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const raw = req.body as Buffer;
  if (!verifyWebhookSignature(raw, req.header("x-razorpay-signature"))) return res.sendStatus(401);
  try {
    const event = JSON.parse(raw.toString("utf8"));
    const eventId = req.header("x-razorpay-event-id") || `${event.event}:${event.payload?.subscription?.entity?.id ?? ""}:${event.created_at}`;
    await handleWebhook(eventId, event);
    res.sendStatus(200);
  } catch (e) {
    console.error("[razorpay webhook]", e);
    res.sendStatus(500); // Razorpay retries on non-2xx
  }
});

