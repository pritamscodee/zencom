# Zencom — Agentic Customer Support Platform

AI support agent + shared inbox. Customers write from the website messenger; the AI answers from the business's own
documents (RAG), checks HubSpot for context, opens tickets for real issues and hands off to a human when it isn't
confident. Teams approve resolutions or send tickets to Slack / Linear.

```
frontend/   Next.js 16 · TypeScript · HeroUI v3 · Tailwind v4 · GSAP     → http://localhost:3000
backend/    Express 5 · TypeScript · Prisma 7 (Neon) · Better Auth · Socket.IO · OpenAI Agents SDK · Trigger.dev
            → http://localhost:4000
```

## Run locally

```bash
# 1. Backend
cd backend
bun install                 # also runs `prisma generate`
cp .env.example .env        # fill in keys (see below) — DATABASE_URL + BETTER_AUTH_SECRET are required
bun run db:deploy           # apply migrations to Neon (db:migrate for new schema changes)
bun run dev                 # API + Socket.IO on :4000

# 2. Frontend
cd ../frontend
bun install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
bun run dev                 # :3000

# 3. Optional: Trigger.dev worker (only when TRIGGER_SECRET_KEY is set)
cd ../backend && bun run trigger:dev
```

Open http://localhost:3000 → **Start free** → create a workspace. Settings → Chat widget → **Preview on a test page**
opens a sample site with the real embed script so you can chat as a customer and answer from the inbox.

## Environment (backend/.env)

| Key | Needed for | Without it |
|---|---|---|
| `DATABASE_URL`, `BETTER_AUTH_SECRET` | everything | app won't start |
| `OPENAI_API_KEY` (`OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_FAST_MODEL`) | AI agent, embeddings, query rewriting, LLM judge | every conversation is escalated to a human |
| `PINECONE_API_KEY` (`PINECONE_INDEX`) | knowledge base + reranking (index auto-created: 1536-d, cosine) | documents upload but fail indexing; AI has no docs |
| `R2_*` | document storage on Cloudflare R2 | files stored in `backend/uploads/` |
| `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF` | ingestion + "Send to" jobs on Trigger.dev | jobs run in-process |
| `RESEND_API_KEY`, `EMAIL_FROM` | team invitation emails + Resend button | invite creates a copyable link |
| `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_STARTER/GROWTH` | Billing page, subscriptions, plan limits | everyone stays on Free limits; upgrade disabled |
| `LANGFUSE_PUBLIC_KEY/SECRET_KEY`, `LANGFUSE_BASE_URL`, `LANGFUSE_EVAL_SAMPLE_RATE` | traces, online evals, `bun run eval` | no tracing/evals (everything else works) |
| `RAG_*` | retrieval tuning (defaults are calibrated) | defaults |
| `HUBSPOT_CLIENT_ID/SECRET` | HubSpot OAuth (redirect `{BACKEND_URL}/api/integrations/hubspot/callback`) | Connect button disabled |
| `SLACK_CLIENT_ID/SECRET` | Slack OAuth (redirect `…/slack/callback`) | ″ |
| `LINEAR_CLIENT_ID/SECRET` | Linear OAuth (redirect `…/linear/callback`) | ″ |

OAuth callbacks and the Razorpay webhook need a public HTTPS URL — run a tunnel (`ngrok http 4000`) and set
`BACKEND_URL` to it.

## Architecture

### 1. System & data flow

```
                                                        ┌────────────────────── Customers ──────────────────────┐
                                                        │  Website messenger: widget.js → iframe /widget/[key]  │
                                                        └───────────────────────────┬───────────────────────────┘
                                                               Socket.IO /widget (public key + visitor id)
                                                                                    ▼
┌──────── Agents: Next.js dashboard ────────┐  REST + WS  ┌──────────────── Express API (Bun) ────────────────┐
│ Inbox · Tickets · Document Hub ·          │◄───────────►│ Better Auth (sessions, orgs = workspaces)          │
│ Connectors · Team · Billing · Settings    │             │ requireWorkspace → membership check                │
│ Socket.IO /agent (cookie session)         │             │ = tenant boundary (every query by workspaceId)     │
└───────────────────────────────────────────┘             └───────┬────────────────┬──────────────┬────────────┘
                                                                  │                │              │
                receiveCustomerMessage() → Message(CUSTOMER) → scheduleAgentReply() │              │
                                                                  ▼                │              │
                             ┌─────────────────────────────────────────────────┐   │              │
                             │ AI agent pipeline (services/agent.ts) — see §2  │   │              │
                             └──┬──────────────┬──────────────┬─────────────┬──┘   │              │
                                ▼              ▼              ▼             ▼      │              │
                         Pinecone        OpenAI         HubSpot      Tickets ──► Slack / Linear   │
                         (ns = workspace) LLM · embeds ·  (live CRM)  (Trigger.dev job or         │
                         vectors+rerank  moderation                   in-process)                 │
                                                                                                  ▼
┌──────────────── Postgres (Neon · Prisma) ───────────────┐ ┌──── R2 / ./uploads ────┐ ┌──── Langfuse ─────────┐
│ user · session · organization · member · invitation     │ │ {ws}/documents/{doc}/  │ │ traces (OTel) ·       │
│ WorkspaceSettings · Customer · Conversation · Ticket    │ │   v{N}/file            │ │ scores · experiments  │
│ Message.metadata {sources, citations, confidence,       │ └────────────────────────┘ └───────────────────────┘
│   guardrails, traceId, feedback} · Document             │ ┌──── Resend ────────────┐ ┌──── Razorpay ─────────┐
│ Integration (AES-GCM creds) · Subscription · BillingEvent│ │ invitation emails      │ │ subscriptions ·       │
└──────────────────────────────────────────────────────────┘ └────────────────────────┘ │ checkout · webhooks   │
                                                                                        └───────────────────────┘
```

### 2. Agentic architecture (one customer message → one AI reply)

```
Customer message
  │
  ▼
runAgent(conversationId)        serialised per conversation; message bursts coalesce into one run
  ├─ aiActive? aiEnabled? OpenAI configured?
  ├─ plan quota: AI replies this month < plan limit ──── no ──► escalate ("limit reached — upgrade")
  └─ load last 24 messages
  │
  ▼
generateReply()   ═══ one Langfuse trace (session = conversation, user = customer) ═══════════════════
  │
  ├─[parallel]─┬─ INPUT GUARDRAIL (guardrails.ts)
  │            │    truncate · redact card/Aadhaar/PAN · prompt-injection patterns · OpenAI moderation
  │            │    ├─ refuse   → polite on-topic refusal, AI stays on                ──┐
  │            │    └─ escalate → safe reply (+ helpline for self-harm), hand to human ──┤ return early,
  │            │                                                                        │ no LLM call
  │            └─ QUERY PLANNER (fast model, JSON schema)                               │
  │                 needs_retrieval? · standalone query · ≤ 2 variant phrasings         │
  │                                                                                     │
  ├─ RETRIEVAL (only if needs_retrieval) — see §3 ──► sources S1..Sn                    │
  │                                                                                     │
  ├─ AGENT LOOP (OpenAI Agents SDK · maxTurns 6 · structured output)                    │
  │    system: persona · rules · security rules · <knowledge><source id="S1">…</source></knowledge>
  │    tools:  search_knowledge_base   follow-up retrieval (adds S7, S8 …)              │
  │            search_crm              HubSpot, live                                    │
  │            create_support_ticket   one per conversation, upserts                    │
  │            escalate_to_human                                                        │
  │    output: { reply, citations[], confidence, needs_human, reason }                  │
  │                                                                                     │
  ├─ OUTPUT GUARDRAIL                                                                   │
  │    block → leaked internals · unknown PII / emails · links to unverified domains · moderation
  │    clean → drop invalid citations · strip [S1] markers                              │
  │    calibrate → docs question with no sources: confidence ≤ 0.4; sources but no citation: ≤ 0.5
  │                                                                                     │
  ▼                                                                                     ▼
Message(AI) saved { confidence, citations, sources, tools, guardrails, traceId } ◄──────┘
  │
  ├─ escalate if: escalate tool called · needs_human · guardrail block · confidence < workspace threshold
  │     → conversation PENDING, AI off, agents notified over Socket.IO
  │
  └─ EVALS → Langfuse scores on the same trace
        deterministic: confidence · escalated · guardrail_input/output · retrieval_top_score · sources_cited
        LLM judge (sampled, LANGFUSE_EVAL_SAMPLE_RATE): groundedness · answer_relevance
        human: agent_feedback (👍/👎 in inbox) · human_takeover (agent replied while AI was active)
```

### 3. RAG pipeline

```
INGESTION — Trigger.dev task "ingest-document" (retries ×3), or in-process without TRIGGER_SECRET_KEY

 upload ─► R2  {ws}/documents/{doc}/v{N}/file ─► extract (pdf-parse · mammoth · html strip · plain text)
   │
   ▼
 normalise: de-hyphenate PDF line wraps · drop repeated headers/footers + page numbers · collapse whitespace
   │
   ▼
 structure-aware chunking
   headings (# md · "2.3 Title" · UPPER / Title-case lines) → section label on every chunk
   ~450 tokens · sentence-boundary splits · 60-token sentence overlap inside a section
   tiny sections merged ("Refunds / Shipping") · dedupe by content hash
   │
   ▼
 embed "Document: <name>\nSection: <section>\n\n<text>"     (contextual header · text-embedding-3-small)
   │
   ▼
 Pinecone upsert   id = {doc}:v{N}:{i}   namespace = workspaceId   metadata {doc, section, text, hash, version}
   │
   ▼
 delete every other version of {doc}  ← only after vN is fully indexed (zero-downtime re-index)


QUERY TIME

 conversation ─► planner: standalone query + variants             ("hi", "thanks" → skip retrieval)
   │
   ▼
 embed each query (LRU cache 15 min) ─► Pinecone topK 20 per query, this workspace's namespace only
   │
   ▼
 Reciprocal Rank Fusion across queries ─► dedupe by hash ─► 20 candidates
   │
   ▼
 cross-encoder rerank (Pinecone bge-reranker-v2-m3)               on error: fall back to vector score ≥ 0.30
   │   measured: relevant ≈ 0.45–0.98 · unrelated ≈ 0.002 → keep ≥ 0.08
   ▼
 diversity ≤ 3 chunks per document ─► token budget 3,000 ─► top 6
   │
   ▼
 <knowledge><source id="S1" document="…" section="…">…</source>…</knowledge>
   fenced as untrusted data (indirect prompt-injection defence); the model must cite source ids
```

### 4. Billing (Razorpay Subscriptions)

```
Owner clicks Upgrade ─► POST /api/billing/checkout {plan}
  ├─ already paying → subscriptions.update(plan_id, schedule_change_at = now)   (no second mandate)
  └─ otherwise      → subscriptions.create(plan_id, notes{workspaceId}) → row status "created" (still Free)
        │
        ▼
Razorpay Checkout (subscription_id) ─► customer authorises the mandate
        │
        ├─ handler → POST /api/billing/verify   HMAC_SHA256(payment_id|subscription_id, key_secret)   fast path
        └─ webhook → POST /webhooks/razorpay    HMAC_SHA256(raw body, webhook_secret), idempotent per event id
                     subscription.activated · charged · pending · halted · cancelled · completed
        │
        ▼
syncSubscription() → Subscription { plan, status, currentPeriodEnd }
effectivePlan: active | authenticated | pending → paid limits · cancelled → paid until period end · else Free

Limits: seats     → Better Auth membershipLimit + beforeCreateInvitation (members + pending invites)
        documents → upload route
        AI/month  → runAgent (over the limit → conversation goes to the team)
```

| Plan | Price | Seats | AI replies / month | Documents |
|---|---|---|---|---|
| Free | ₹0 | 2 | 50 | 5 |
| Starter | ₹399 / month | 3 | 500 | 50 |
| Growth | ₹699 / month | 10 | 1,500 | 200 |

Limits live in `backend/src/lib/plans.ts`; the amount charged is whatever the Razorpay plan says.

### 5. Team invitations (Resend)

```
Team → Invite ─► Better Auth organization.inviteMember
  ├─ beforeCreateInvitation: seat check against the plan (resends don't use a seat)
  └─ sendInvitationEmail ─► Resend (HTML + text, reply-to = inviter, idempotency key per invite + expiry)
        on failure: logged; the invite still exists and "Copy link" still works
Pending invite → Resend ─► inviteMember({ resend: true }) → new expiry + new email
Link ─► /accept-invite/{id}
```

### 6. Observability & evals (Langfuse)

- **Traces**: `backend/src/lib/observability.ts` registers an OpenTelemetry tracer with `LangfuseSpanProcessor`
  (PII masked before export). One reply = one trace: `support-agent` → `guardrail.input`, `rag.query-rewrite`,
  `rag.retrieve`, `agent.run` (token usage), `tool.*`, `guardrail.output`.
- **Online evals**: the scores listed in §2. In Langfuse, filter on `escalated = 1` or low `groundedness` to find
  weak answers.
- **Offline evals**: `bun run eval --workspace <id>` runs `src/evals/dataset.example.json` through the real pipeline
  in dry-run mode (no messages, tickets or CRM writes) as a Langfuse experiment. Use `--dataset <name>` to run a
  dataset kept in Langfuse, or `--push <name>` to upload the file. It scores groundedness, relevance,
  correctness, escalation_match and guardrail_match, and exits 1 when mean groundedness < `--min` (default 0.7),
  so it can gate prompt and model changes in CI.

### Other

- **Tenancy**: workspace = Better Auth organization. Every query is scoped by `workspaceId` after a membership check
  (`backend/src/middleware/auth.ts`). Pinecone namespace = workspaceId; R2 keys are prefixed with workspaceId.
  Roles: Owner / Admin / Agent (`member`). Only the owner can change billing.
- **Realtime**: Socket.IO namespaces `/agent` (dashboard, cookie session) and `/widget` (visitor, public key +
  anonymous visitor id).
- **Messenger**: `backend/public/widget.js` loader → iframe `frontend/app/widget/[key]`. Home (greeting, team,
  help search over the docs), Messages, conversation view, email capture.
- **Security**: integration tokens AES-256-GCM encrypted; OAuth `state` HMAC-signed and expiring; Razorpay webhooks
  signature-verified and de-duplicated.

## Brand

Logo mechanism, "the handoff": a Z drawn as a conversation (message bar → handoff diagonal → reply bar with a bubble
tail). Source: `frontend/components/brand/logo.tsx`; files in `frontend/public/brand/`; favicon `frontend/app/icon.svg`.
Measured contrast: brand blue `#0052F2` on white 6.02:1, white on blue 6.02:1, light blue `#4083FF` on white 3.55:1.
Blue on near-black is 2.99:1, so dark grounds use the white mark. Integration logos are official marks
(Linear, HubSpot from Simple Icons; Slack from Slack's brand assets) used to name the integrations.
