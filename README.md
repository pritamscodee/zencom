<div align="center">

<img src="frontend/app/icon.svg" width="72" alt="Zencom logo" />

# Zencom

### An AI support agent that answers from your own documents, takes action, and passes the conversation to your team when it isn't sure.

Website messenger · Shared inbox · Agentic RAG · Tickets · HubSpot / Slack / Linear · Multi-tenant SaaS

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-149eca?logo=react&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)
![Postgres](https://img.shields.io/badge/Postgres_(Neon)-4169E1?logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_Agents_SDK-412991?logo=openai&logoColor=white)
![Pinecone](https://img.shields.io/badge/Pinecone-000?logoColor=white)
![Trigger.dev](https://img.shields.io/badge/Trigger.dev-6366F1?logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white)

</div>

---

## Contents

1. [The problem](#-the-problem)
2. [What Zencom does](#-what-zencom-does)
3. [Why it's agentic, not a chatbot](#-why-its-agentic-not-a-chatbot)
4. [Architecture](#-architecture)
   - [System overview](#1-system-overview)
   - [Lifecycle of a customer message](#2-lifecycle-of-a-customer-message)
   - [The agent loop](#3-the-agent-loop)
   - [RAG pipeline](#4-rag-pipeline)
   - [Guardrails](#5-guardrails)
   - [Human handoff and tickets](#6-human-handoff-and-tickets)
   - [Multi-tenancy and security](#7-multi-tenancy-and-security)
   - [Observability and evals](#8-observability-and-evals)
   - [Billing](#9-billing)
5. [Tech stack](#-tech-stack)
6. [Project structure](#-project-structure)
7. [Run locally](#-run-locally)
8. [Environment variables](#-environment-variables)
9. [Deploy](#-deploy)

---

## 🔥 The problem

Customer support breaks in the same few ways at almost every growing company:

```
┌──────────────────────────────┬───────────────────────────────────────────────────────────────┐
│ Pain                         │ What it looks like                                            │
├──────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Repetitive volume            │ Most tickets ask things the help docs already answer          │
│ Slow first response          │ Customers wait hours, often overnight, for "where's my refund" │
│ Rule-based bots              │ Decision trees that frustrate users and can't read your docs  │
│ Plain LLM chatbots           │ Confident wrong answers, invented policies, no citations,      │
│                              │ prompt injection, leaked PII, and no way to know it's wrong   │
│ Lost context on handoff      │ A human picks up with no transcript, CRM data or summary      │
│ Tools that don't talk        │ Chat in one place, CRM in another, engineering bugs in a third│
│ No quality signal            │ Nobody can tell whether the AI is getting better or worse     │
└──────────────────────────────┴───────────────────────────────────────────────────────────────┘
```

The real problem isn't making an LLM talk. It's making an AI you can **trust in front of customers**: it knows
what it knows, says so when it doesn't, takes the right action, and hands over cleanly.

## ✅ What Zencom does

```
  Customer on your website                      Your support team
  ────────────────────────                      ─────────────────
  opens the messenger  ─────►  AI agent  ─────►  shared inbox (live, Socket.IO)
                               │
                               ├─ answers from YOUR documents, with citations
                               ├─ looks the customer up in HubSpot
                               ├─ opens a ticket with a proposed resolution
                               ├─ refuses unsafe or off-topic requests
                               └─ hands off to a human when confidence is low
                                         │
                                         ▼
                               agent approves the resolution, or sends the ticket
                               to Slack / Linear with one click
```

| For customers | For support teams | For the business |
|---|---|---|
| Instant answers at any hour | One inbox for AI and human conversations | Plan-based limits for seats, AI replies and documents |
| Answers cite the source documents | Escalations arrive with full context | Every AI reply traced and scored (Langfuse) |
| A real person when it matters | Drag-and-drop knowledge base | Offline eval suite that can block regressions in CI |
| Embeddable widget, one script tag | Tickets, assignees, priorities, activity log | Razorpay subscriptions |

## 🤖 Why it's agentic, not a chatbot

A chatbot maps **input → text**. Zencom's agent **plans, uses tools, checks its own output and decides what happens
next**:

```
                 Chatbot                                      Zencom agent
   ───────────────────────────────              ───────────────────────────────────────────
   message ─► LLM ─► reply                      message
                                                  │
                                                  ├─ PERCEIVE  input guardrail · moderation · PII redaction
                                                  ├─ PLAN      query planner: retrieve? rewrite? variants?
                                                  ├─ RETRIEVE  hybrid multi-query RAG + reranker
                                                  ├─ ACT       tool loop (up to 6 turns):
                                                  │              search_knowledge_base (follow-up search)
                                                  │              search_crm            (live HubSpot)
                                                  │              create_support_ticket (with resolution)
                                                  │              escalate_to_human
                                                  ├─ VERIFY    output guardrail · citation check ·
                                                  │            confidence calibration
                                                  ├─ DECIDE    reply, or hand off to a human
                                                  └─ LEARN     scores per trace + agent 👍/👎 feedback
```

| Property | How Zencom does it |
|---|---|
| **Autonomy** | Picks its own tools inside an OpenAI Agents SDK loop (`maxTurns: 6`) |
| **Grounding** | Answers only from `<knowledge>` sources and must cite `S1…Sn`; uncited claims lower confidence |
| **Self-assessment** | Returns structured `{ reply, citations, confidence, needs_human, reason }` |
| **Knowing its limits** | Below the workspace's confidence threshold it hands off instead of guessing |
| **Taking action** | Creates and updates tickets, reads the CRM, routes work to Slack and Linear |
| **Safety** | Guardrails on both input and output; retrieved text is treated as untrusted data |
| **Accountability** | Every decision is traced, scored and linked from the message (`traceId`) |

---

## 🏗 Architecture

### 1. System overview

```
                         ┌──────────────────────────── Customers ────────────────────────────┐
                         │  any website  →  <script src=".../widget.js">  →  iframe /widget/[key] │
                         └──────────────────────────────────┬─────────────────────────────────┘
                                                            │ Socket.IO /widget
                                                            │ (public key + anonymous visitor id)
                                                            ▼
┌──────── Support team: Next.js 16 ────────┐  REST + WS ┌─────────────────── API: Express 5 on Bun ───────────────────┐
│ Inbox · Tickets · Document Hub ·          │◄──────────►│ Better Auth  — sessions, organizations = workspaces          │
│ Connectors · Team · Billing · Settings    │ /agent ns  │ requireWorkspace — membership check = tenant boundary        │
│ (cookie session)                          │            │ routes · socket server · webhooks (raw body, HMAC)           │
└───────────────────────────────────────────┘            └──────┬──────────────┬────────────────┬─────────────────────┘
                                                                 │              │                │
                          receiveCustomerMessage → scheduleAgentReply           │                │
                                                                 ▼              │                │
                                  ┌──────────────────────────────────────┐      │                │
                                  │   AI agent pipeline (services/agent)  │      │                │
                                  └──┬──────────┬───────────┬─────────┬──┘      │                │
                                     ▼          ▼           ▼         ▼         ▼                ▼
                                Pinecone     OpenAI      HubSpot   Tickets ─► Trigger.dev ─► Slack / Linear
                                vectors +    LLM · embed (live CRM)           (or in-process)
                                reranker     moderation                       ingest-document · send-ticket

┌────────── Postgres (Neon · Prisma 7) ──────────┐ ┌─ Cloudflare R2 ─┐ ┌─ Langfuse ─┐ ┌─ Resend ─┐ ┌─ Razorpay ─┐
│ user · session · organization · member         │ │ document files  │ │ OTel traces│ │ invites  │ │ subscriptions│
│ WorkspaceSettings · Customer · Conversation    │ │ versioned per   │ │ scores ·   │ │          │ │ webhooks   │
│ Message · Ticket · TicketActivity · Document   │ │ workspace       │ │ experiments│ │          │ │            │
│ Integration (AES-GCM) · Subscription · Billing │ └─────────────────┘ └────────────┘ └──────────┘ └────────────┘
└─────────────────────────────────────────────────┘
```

### 2. Lifecycle of a customer message

```
 widget                API / socket                 agent pipeline               team dashboard
   │                        │                             │                             │
   │── "where's my refund?" ►│                             │                             │
   │                        │ upsert Customer             │                             │
   │                        │ find-or-create Conversation │                             │
   │                        │ save Message(CUSTOMER) ─────┼──── broadcast (/agent) ────►│ appears live
   │                        │ scheduleAgentReply ────────►│                             │
   │                        │                             │ one run at a time per convo; │
   │                        │                             │ message bursts coalesce      │
   │                        │                             │ check quota · AI on/off      │
   │                        │                             │ guardrails → plan → RAG →    │
   │                        │                             │ tool loop → verify           │
   │                        │◄── Message(AI) + metadata ──│                             │
   │◄── reply (typing...) ──│                             │                             │
   │                        │──────────── broadcast ──────┼────────────────────────────►│ sources, confidence
   │                        │                             │                             │
   │                        │   confidence < threshold OR needs_human OR guardrail block│
   │                        │──── conversation → PENDING, AI off, "escalated" event ───►│ 🔔 badge
   │                        │                             │                             │ human replies
   │◄─────────────── agent reply (Message(AGENT)) ────────┼─────────────────────────────│
```

### 3. The agent loop

```
runAgent(conversationId)
  ├─ aiActive?  aiEnabled?  OpenAI configured?
  ├─ plan quota: AI replies this month < plan limit ───── no ──► escalate ("limit reached")
  └─ load the last 24 messages
  │
  ▼
generateReply()   ════ one Langfuse trace (session = conversation, user = customer) ════
  │
  ├─[parallel]─┬─ INPUT GUARDRAIL ─── refuse ──► polite on-topic refusal ────────────┐
  │            │                  └── escalate ► safe reply + human handoff ─────────┤ early return
  │            └─ QUERY PLANNER (fast model, JSON schema)                             │ (no LLM call)
  │                 { needs_retrieval, standalone_query, variants[≤2] }               │
  │                                                                                   │
  ├─ RETRIEVAL (if needed) ──► sources S1..Sn                                         │
  │                                                                                   │
  ├─ AGENT (OpenAI Agents SDK · maxTurns 6 · structured output)                       │
  │    system  = persona + rules + security rules + <knowledge><source id="S1">…      │
  │    tools   = search_knowledge_base · search_crm · create_support_ticket ·         │
  │              escalate_to_human                                                    │
  │    output  = { reply, citations[], confidence, needs_human, reason }              │
  │                                                                                   │
  ├─ OUTPUT GUARDRAIL + CALIBRATION                                                   │
  │    docs question, no sources       → confidence ≤ 0.4                            │
  │    sources but nothing cited       → confidence ≤ 0.5                            │
  │    invalid citations dropped · [S1] markers stripped                              │
  ▼                                                                                   ▼
Message(AI) { confidence, citations, sources, tools, guardrails, traceId } ◄──────────┘
  │
  ├─ escalate? (tool called · needs_human · guardrail block · confidence < threshold)
  └─ scores → Langfuse
```

### 4. RAG pipeline

```
INGESTION   (Trigger.dev task "ingest-document", retries ×3; runs in-process without a key)

 upload ─► R2  {workspace}/documents/{doc}/v{N}/file
   │
   ▼
 extract      pdf-parse · mammoth (docx) · HTML strip · plain text / markdown
   ▼
 normalise    de-hyphenate PDF line wraps · drop repeated headers/footers + page numbers
   ▼
 chunk        structure-aware: headings → section label on every chunk
              ~450 tokens · sentence-boundary splits · 60-token overlap inside a section
              tiny sections merged · dedupe by content hash
   ▼
 embed        "Document: <name>\nSection: <section>\n\n<text>"   (contextual header)
   ▼
 upsert       Pinecone · id {doc}:v{N}:{i} · namespace = workspaceId
   ▼
 cleanup      delete older versions only after vN is fully indexed (no downtime when re-indexing)


QUERY TIME

 conversation ─► planner → standalone query + up to 2 variants     ("hi", "thanks" → skip)
   ▼
 embed each (LRU cache, 15 min) ─► Pinecone top 20 per query, this workspace's namespace only
   ▼
 Reciprocal Rank Fusion across queries ─► dedupe ─► 20 candidates
   ▼
 cross-encoder rerank (bge-reranker-v2-m3) ─► keep score ≥ 0.08
   │   (on reranker error: fall back to vector score ≥ 0.30)
   ▼
 diversity: ≤ 3 chunks per document ─► 3,000-token budget ─► top 6
   ▼
 <knowledge><source id="S1" document="…" section="…">…</source></knowledge>
   fenced as untrusted data; the model must cite source ids
```

### 5. Guardrails

```
INPUT  ─────────────────────────────────────────────  OUTPUT ──────────────────────────────────────
 truncate oversized messages                            block leaked system prompt / internals
 redact card numbers · Aadhaar · PAN                     block PII or emails the customer never gave
 detect prompt-injection patterns                        block links to unverified domains
 OpenAI moderation                                       OpenAI moderation on the reply
   ├─ refuse   → on-topic refusal, AI stays on           drop citations that point to no source
   └─ escalate → safe reply (self-harm: helpline)        cap confidence when answers aren't grounded
                 + human handoff
```

### 6. Human handoff and tickets

```
 Conversation:  OPEN ──(escalate)──► PENDING ──(agent replies / resolves)──► RESOLVED
                 AI on                  AI off, team notified

 Ticket (one per conversation, created by the agent or by a human):
   OPEN ─► IN_PROGRESS ─► RESOLVED ─► CLOSED        priority LOW · MEDIUM · HIGH · URGENT
     │
     ├─ proposedResolution written by the AI ─► agent edits ─► "Resolve & send" to customer
     ├─ "Send to Slack"  ─┐
     └─ "Send to Linear" ─┴─► Trigger.dev "send-ticket" job ─► TicketActivity log
```

### 7. Multi-tenancy and security

```
 workspace = Better Auth organization        roles: owner · admin · member ("Agent")

 every request ─► session cookie ─► requireWorkspace ─► membership check ─► queries scoped by workspaceId
                                                                          ├─ Pinecone namespace = workspaceId
                                                                          ├─ R2 keys prefixed with workspaceId
                                                                          └─ Socket.IO rooms per workspace

 integration tokens   AES-256-GCM encrypted at rest
 OAuth state          HMAC-signed, expiring
 webhooks             signature-verified (raw body), idempotent per event id
 widget               public key only; no access to dashboard APIs
 billing              owner-only
```

### 8. Observability and evals

```
 one AI reply = one trace
   support-agent
     ├─ guardrail.input
     ├─ rag.query-rewrite
     ├─ rag.retrieve
     ├─ agent.run          (token usage)
     │    └─ tool.*
     └─ guardrail.output

 online scores   confidence · escalated · guardrail_input/output · retrieval_top_score · sources_cited
 LLM judge       groundedness · answer_relevance                    (sampled: LANGFUSE_EVAL_SAMPLE_RATE)
 human signals   agent_feedback (👍/👎 in inbox) · human_takeover

 offline         bun run eval --workspace <id>
                 dataset → real pipeline in dry-run mode → Langfuse experiment
                 exits 1 when mean groundedness < --min (default 0.7), so it can gate CI
```

### 9. Billing

```
 Upgrade ─► POST /api/billing/checkout
   ├─ already subscribed → change plan in place (no second mandate)
   └─ new                → Razorpay subscription → Checkout
                              ├─ /api/billing/verify      HMAC fast path
                              └─ /webhooks/razorpay       source of truth, idempotent
                                       ▼
                               Subscription { plan, status, currentPeriodEnd } → plan limits
```

| Plan | Price | Seats | AI replies / month | Documents |
|---|---|---|---|---|
| Free | ₹0 | 2 | 50 | 5 |
| Starter | ₹399 / month | 3 | 500 | 50 |
| Growth | ₹699 / month | 10 | 1,500 | 200 |

Limits live in `backend/src/lib/plans.ts`.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, HeroUI v3, Tailwind CSS v4, GSAP |
| Backend | Bun, Express 5, TypeScript, Socket.IO |
| Auth | Better Auth (email/password, organizations, invitations) |
| Database | PostgreSQL on Neon, Prisma 7 |
| AI | OpenAI Agents SDK, OpenAI models, embeddings and moderation |
| Retrieval | Pinecone serverless + `bge-reranker-v2-m3` |
| Background jobs | Trigger.dev v4 (falls back to in-process) |
| Storage | Cloudflare R2 (falls back to local disk) |
| Integrations | HubSpot, Slack, Linear (OAuth) |
| Email / billing | Resend · Razorpay Subscriptions |
| Observability | OpenTelemetry → Langfuse (traces, scores, experiments) |

## 📁 Project structure

```
zencom/
├── render.yaml                  Render blueprint for the API
├── backend/
│   ├── prisma/                  schema + migrations
│   ├── public/widget.js         embeddable loader script
│   ├── trigger.config.ts        Trigger.dev build config
│   └── src/
│       ├── index.ts             Express + Socket.IO entry point
│       ├── lib/                 auth · env · db · crypto · storage · email · plans · observability
│       ├── middleware/auth.ts   workspace / tenant boundary
│       ├── routes/              workspace · conversations · tickets · documents · integrations ·
│       │                        members · billing · public (widget) · webhooks
│       ├── services/
│       │   ├── agent.ts         the agent loop and tools
│       │   ├── guardrails.ts    input / output safety
│       │   ├── rag/             chunking · retrieval (multi-query, RRF, rerank)
│       │   ├── ingestion.ts     extract → normalise → chunk → embed → upsert
│       │   ├── evals.ts         LLM judge + Langfuse scores
│       │   ├── tickets.ts       ticket lifecycle + Slack / Linear routing
│       │   └── billing.ts       plans, quotas, Razorpay sync
│       ├── integrations/        hubspot · slack · linear
│       ├── socket/              /agent and /widget namespaces
│       ├── trigger/tasks.ts     ingest-document · send-ticket
│       └── evals/run.ts         offline eval runner
└── frontend/
    ├── app/
    │   ├── (auth)/              login · signup
    │   ├── onboarding/          create a workspace
    │   ├── app/                 inbox · tickets · documents · connectors · team · billing · settings
    │   └── widget/[key]/        customer messenger (rendered in the iframe)
    ├── components/              app shell · inbox · tickets · landing · brand · ui
    └── lib/                     api client · hooks · types
```

---

## 🚀 Run locally

**Requires:** [Bun](https://bun.sh) ≥ 1.3, a Postgres database (e.g. [Neon](https://neon.tech)), and an OpenAI key
for the AI features.

```bash
# 1. Backend
cd backend
bun install                 # also runs `prisma generate`
cp .env.example .env        # DATABASE_URL + BETTER_AUTH_SECRET are required
bun run db:deploy           # apply migrations
bun run dev                 # API + Socket.IO on http://localhost:4000

# 2. Frontend
cd ../frontend
bun install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
bun run dev                 # http://localhost:3000

# 3. Optional: Trigger.dev worker (only when TRIGGER_SECRET_KEY is set)
cd ../backend && bun run trigger:dev
```

Open http://localhost:3000 → **Start free** → create a workspace. Upload a document in **Document Hub**, then go to
**Settings → Chat widget → Preview on a test page** to chat as a customer and reply from the inbox.

Useful scripts (backend): `bun run typecheck` · `bun run db:migrate` · `bun run eval --workspace <id>`

## 🔑 Environment variables

Every integration is optional. Without its keys the feature turns off or uses a fallback, and the rest of the app keeps working.

| Key | Needed for | Without it |
|---|---|---|
| `DATABASE_URL`, `BETTER_AUTH_SECRET` | everything | app won't start |
| `BACKEND_URL`, `FRONTEND_URL` | auth, CORS, OAuth callbacks, embed snippet | localhost defaults |
| `ENCRYPTION_KEY` | encrypting integration tokens (64 hex chars) | derived from `BETTER_AUTH_SECRET` |
| `OPENAI_API_KEY` (`OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_FAST_MODEL`) | agent, embeddings, planner, judge | every conversation goes to a human |
| `PINECONE_API_KEY` (`PINECONE_INDEX`) | knowledge base + reranking (index auto-created) | documents can't be indexed |
| `R2_*` | document storage | files saved to `backend/uploads/` |
| `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF` | background jobs on Trigger.dev | jobs run in-process |
| `RESEND_API_KEY`, `EMAIL_FROM` | invitation emails | copyable invite link |
| `RAZORPAY_*` | billing and plan upgrades | everyone stays on Free |
| `LANGFUSE_*` | traces, online and offline evals | no tracing |
| `HUBSPOT_*`, `SLACK_*`, `LINEAR_*` | OAuth connectors (redirect `{BACKEND_URL}/api/integrations/<name>/callback`) | Connect button disabled |
| `RAG_*` | retrieval tuning | calibrated defaults |

OAuth callbacks and the Razorpay webhook need a public HTTPS URL. Locally, use a tunnel (`ngrok http 4000`) and set
`BACKEND_URL` to it.

## ☁️ Deploy

```
 frontend  ──►  Vercel        (root: frontend · env NEXT_PUBLIC_API_URL = https://<api>)
 backend   ──►  Render        (render.yaml blueprint · Bun native runtime)
 jobs      ──►  Trigger.dev   (cd backend && bun run trigger:deploy)
 database  ──►  Neon Postgres
```

**API on Render:** New → **Blueprint** → select this repo. Then fill in `BACKEND_URL`, `FRONTEND_URL`,
`DATABASE_URL`, `ENCRYPTION_KEY` and the keys for the features you use. Each deploy runs `bun install`, applies
migrations (`prisma migrate deploy`) and starts the server, with `/health` as the health check. When `BACKEND_URL` is
HTTPS, auth cookies are set to `SameSite=None; Secure`, so the dashboard and API can live on different domains.

> Render's disk is wiped on every deploy. Configure Cloudflare R2 so uploaded documents persist. Real-time chat
> needs an always-on instance; free instances sleep when idle.

After deploying, point the OAuth redirect URLs and the Razorpay webhook (`{BACKEND_URL}/webhooks/razorpay`) at the
API's public URL.

---

<div align="center">
<sub>Built with Next.js, Bun, OpenAI Agents SDK, Pinecone and Trigger.dev.</sub>
</div>
