import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { env, features } from "./env";

/**
 * Langfuse = traces (OpenTelemetry via @langfuse/tracing) + scores/datasets/experiments (@langfuse/client).
 * Without keys every helper is a no-op: @langfuse/tracing creates non-recording spans when no provider is registered.
 */

// The Langfuse SDKs read these from process.env.
if (features.langfuse()) {
  process.env.LANGFUSE_PUBLIC_KEY ??= env.LANGFUSE_PUBLIC_KEY;
  process.env.LANGFUSE_SECRET_KEY ??= env.LANGFUSE_SECRET_KEY;
  process.env.LANGFUSE_BASE_URL ??= env.LANGFUSE_BASE_URL;
}

/** PII masking applied to everything exported to Langfuse. */
export function maskPII(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\b\d(?:[ -]?\d){12,18}\b/g, "[CARD]")
      .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]") // Indian PAN
      .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[AADHAAR]")
      .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, "[SECRET]");
  }
  if (Array.isArray(value)) return value.map(maskPII);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPII(v)]));
  return value;
}

export const spanProcessor = features.langfuse()
  ? new LangfuseSpanProcessor({ mask: ({ data }: { data: unknown }) => maskPII(data), environment: process.env.NODE_ENV === "production" ? "production" : "development" } as any)
  : null;

if (spanProcessor) {
  new NodeTracerProvider({ spanProcessors: [spanProcessor] }).register();
}

export const langfuse = features.langfuse() ? new LangfuseClient() : null;

type ScoreArgs = { traceId: string; observationId?: string; name: string; value: number | string; comment?: string; dataType?: "NUMERIC" | "BOOLEAN" | "CATEGORICAL"; metadata?: Record<string, unknown> };

/** Fire-and-forget score. Booleans are sent as 0/1 with dataType BOOLEAN. */
export function score(args: ScoreArgs) {
  if (!langfuse || !args.traceId) return;
  try {
    langfuse.score.create({ ...args } as any);
  } catch (e) {
    console.warn("[langfuse score]", e);
  }
}

export async function flushObservability() {
  await Promise.allSettled([spanProcessor?.forceFlush(), langfuse?.flush()]);
}

export async function shutdownObservability() {
  await Promise.allSettled([spanProcessor?.shutdown(), langfuse?.shutdown()]);
}
