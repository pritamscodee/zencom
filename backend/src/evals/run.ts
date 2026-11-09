/**
 * Offline evals — runs a dataset through the real agent pipeline (dry-run: no messages, tickets or CRM writes)
 * as a Langfuse experiment, so runs can be compared side by side in Langfuse → Datasets / Experiments.
 *
 *   bun run eval --workspace <workspaceId>                      # local file src/evals/dataset.example.json
 *   bun run eval --workspace <id> --file my-cases.json
 *   bun run eval --workspace <id> --dataset zencom-support      # a dataset managed in the Langfuse UI
 *   bun run eval --workspace <id> --push zencom-support         # upload the local file as a Langfuse dataset
 *
 * Item shape: { input: string, expectedOutput?: string, metadata?: { expectEscalation?: boolean, expectGuardrail?: "allow"|"refuse"|"escalate" } }
 * Exit code 1 if mean groundedness < --min (default 0.7) — usable as a CI gate before prompt/model changes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/db";
import { features } from "../lib/env";
import { flushObservability, langfuse } from "../lib/observability";
import { generateReply, type ReplyResult } from "../services/agent";
import { judgeReply } from "../services/evals";

type Item = { input: string; expectedOutput?: string; metadata?: { expectEscalation?: boolean; expectGuardrail?: string } };

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const workspaceId = arg("workspace");
if (!workspaceId) {
  console.error("Usage: bun run eval --workspace <workspaceId> [--file cases.json | --dataset <name>] [--push <name>] [--min 0.7]");
  process.exit(2);
}
if (!features.langfuse() || !langfuse) {
  console.error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are required for evals.");
  process.exit(2);
}

const ws = await prisma.organization.findUnique({ where: { id: workspaceId }, include: { settings: true } });
if (!ws) {
  console.error(`Workspace ${workspaceId} not found`);
  process.exit(2);
}
const s = ws.settings;
const settings = {
  aiName: s?.aiName ?? "Zen",
  businessName: s?.businessName || ws.name,
  businessDescription: s?.businessDescription,
  website: s?.website,
  supportEmail: s?.supportEmail,
  aiInstructions: s?.aiInstructions,
  autoCreateTickets: s?.autoCreateTickets ?? true,
};
const threshold = s?.confidenceThreshold ?? 0.55;

const file = arg("file") ?? path.join(import.meta.dirname, "dataset.example.json");
const local: Item[] = JSON.parse(await readFile(file, "utf8"));

const pushName = arg("push");
if (pushName) {
  await langfuse.api.datasets.create({ name: pushName, description: `Zencom support evals (${ws.name})` } as any).catch(() => {});
  for (const it of local) {
    await langfuse.api.datasetItems.create({ datasetName: pushName, input: it.input, expectedOutput: it.expectedOutput, metadata: it.metadata } as any);
  }
  console.log(`Pushed ${local.length} items to Langfuse dataset "${pushName}"`);
}

const task = async ({ input }: { input: unknown }) => {
  const r = await generateReply(
    {
      workspaceId,
      conversationId: null,
      customer: { id: null, name: "Eval", email: null },
      channel: "WEB",
      settings,
      history: [{ role: "customer", content: String(input) }],
      hasCrm: false,
    },
    { dryRun: true, traceName: "eval-support-agent" },
  );
  return r;
};

const evaluators = [
  async ({ input, output, expectedOutput }: any) => {
    const r = output as ReplyResult;
    if (r.guardrails.inputAction !== "allow") return [];
    const j = await judgeReply({
      conversation: `CUSTOMER: ${input}`,
      reply: r.reply,
      context: r.chunks.map((c) => `[${c.ref}] ${c.text}`).join("\n\n"),
      expected: expectedOutput ?? null,
    });
    if (!j) return [];
    return [
      { name: "groundedness", value: j.groundedness, comment: j.reasoning },
      { name: "answer_relevance", value: j.answer_relevance },
      ...(j.correctness !== null ? [{ name: "correctness", value: j.correctness }] : []),
    ];
  },
  async ({ output, metadata }: any) => {
    const r = output as ReplyResult;
    const out = [];
    const escalated = Boolean(r.escalation || r.needsHuman || r.confidence < threshold || r.toolsUsed.includes("escalate_to_human"));
    if (metadata?.expectEscalation !== undefined) out.push({ name: "escalation_match", value: escalated === metadata.expectEscalation ? 1 : 0, comment: `escalated=${escalated}` });
    if (metadata?.expectGuardrail) out.push({ name: "guardrail_match", value: r.guardrails.inputAction === metadata.expectGuardrail ? 1 : 0, comment: `input=${r.guardrails.inputAction}` });
    out.push({ name: "confidence", value: r.confidence });
    out.push({ name: "sources_retrieved", value: r.chunks.length });
    return out;
  },
];

const avg = (rows: any[], name: string) => {
  const v = rows.flatMap((r) => r.evaluations ?? []).filter((e: any) => e.name === name && typeof e.value === "number").map((e: any) => e.value as number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const runEvaluators = [
  async ({ itemResults }: any) =>
    ["groundedness", "answer_relevance", "correctness", "escalation_match", "guardrail_match"]
      .map((n) => ({ name: `avg_${n}`, value: avg(itemResults, n) }))
      .filter((e) => e.value !== null) as { name: string; value: number }[],
];

const name = `zencom-agent ${new Date().toISOString().slice(0, 16)}`;
const datasetName = arg("dataset") ?? pushName;
const result = datasetName
  ? await (await langfuse.dataset.get(datasetName)).runExperiment({ name, task, evaluators, runEvaluators, maxConcurrency: 3 } as any)
  : await langfuse.experiment.run({ name, data: local.map((it) => ({ input: it.input, expectedOutput: it.expectedOutput, metadata: it.metadata })), task, evaluators, runEvaluators, maxConcurrency: 3 } as any);

console.log(await result.format());
await flushObservability();

const min = Number(arg("min") ?? "0.7");
const g = avg((result as any).itemResults ?? [], "groundedness");
await prisma.$disconnect();
if (g !== null && g < min) {
  console.error(`✗ mean groundedness ${g.toFixed(2)} < ${min}`);
  process.exit(1);
}
process.exit(0);
