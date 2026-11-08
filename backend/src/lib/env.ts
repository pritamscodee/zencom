import "dotenv/config";

const str = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();

export const env = {
  PORT: Number(str("PORT", "4000")),
  BACKEND_URL: str("BACKEND_URL", "http://localhost:4000").replace(/\/$/, ""),
  FRONTEND_URL: str("FRONTEND_URL", "http://localhost:3000").replace(/\/$/, ""),

  DATABASE_URL: str("DATABASE_URL"),
  BETTER_AUTH_SECRET: str("BETTER_AUTH_SECRET"),
  ENCRYPTION_KEY: str("ENCRYPTION_KEY"),

  OPENAI_API_KEY: str("OPENAI_API_KEY"),
  OPENAI_MODEL: str("OPENAI_MODEL", "gpt-4.1-mini"),
  OPENAI_EMBEDDING_MODEL: str("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
  /** Cheap model for query rewriting and LLM-as-judge evals. */
  OPENAI_FAST_MODEL: str("OPENAI_FAST_MODEL", "gpt-4.1-mini"),

  // ── RAG tuning ──
  RAG_RERANK_MODEL: str("RAG_RERANK_MODEL", "bge-reranker-v2-m3"),
  RAG_CANDIDATES: Number(str("RAG_CANDIDATES", "20")),
  RAG_TOP_K: Number(str("RAG_TOP_K", "6")),
  RAG_MIN_RERANK_SCORE: Number(str("RAG_MIN_RERANK_SCORE", "0.08")),
  RAG_MIN_VECTOR_SCORE: Number(str("RAG_MIN_VECTOR_SCORE", "0.3")),
  RAG_CONTEXT_TOKENS: Number(str("RAG_CONTEXT_TOKENS", "3000")),

  PINECONE_API_KEY: str("PINECONE_API_KEY"),
  PINECONE_INDEX: str("PINECONE_INDEX", "zencom"),
  PINECONE_CLOUD: str("PINECONE_CLOUD", "aws"),
  PINECONE_REGION: str("PINECONE_REGION", "us-east-1"),

  R2_ACCOUNT_ID: str("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: str("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: str("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET: str("R2_BUCKET", "zencom-documents"),

  TRIGGER_SECRET_KEY: str("TRIGGER_SECRET_KEY"),

  // ── Email (Resend) ──
  RESEND_API_KEY: str("RESEND_API_KEY"),
  EMAIL_FROM: str("EMAIL_FROM", "Zencom <onboarding@resend.dev>"),

  // ── Billing (Razorpay) ──
  RAZORPAY_KEY_ID: str("RAZORPAY_KEY_ID"),
  RAZORPAY_KEY_SECRET: str("RAZORPAY_KEY_SECRET"),
  RAZORPAY_WEBHOOK_SECRET: str("RAZORPAY_WEBHOOK_SECRET"),
  RAZORPAY_PLAN_STARTER: str("RAZORPAY_PLAN_STARTER"),
  RAZORPAY_PLAN_GROWTH: str("RAZORPAY_PLAN_GROWTH"),

  // ── Observability & evals (Langfuse) ──
  LANGFUSE_PUBLIC_KEY: str("LANGFUSE_PUBLIC_KEY"),
  LANGFUSE_SECRET_KEY: str("LANGFUSE_SECRET_KEY"),
  LANGFUSE_BASE_URL: str("LANGFUSE_BASE_URL", str("LANGFUSE_HOST", "https://cloud.langfuse.com")).replace(/\/$/, ""),
  /** Fraction of live AI replies scored by the LLM-as-judge (0..1). */
  LANGFUSE_EVAL_SAMPLE_RATE: Number(str("LANGFUSE_EVAL_SAMPLE_RATE", "0.3")),

  HUBSPOT_CLIENT_ID: str("HUBSPOT_CLIENT_ID"),
  HUBSPOT_CLIENT_SECRET: str("HUBSPOT_CLIENT_SECRET"),
  SLACK_CLIENT_ID: str("SLACK_CLIENT_ID"),
  SLACK_CLIENT_SECRET: str("SLACK_CLIENT_SECRET"),
  LINEAR_CLIENT_ID: str("LINEAR_CLIENT_ID"),
  LINEAR_CLIENT_SECRET: str("LINEAR_CLIENT_SECRET"),

};

export const features = {
  openai: () => Boolean(env.OPENAI_API_KEY),
  pinecone: () => Boolean(env.PINECONE_API_KEY),
  r2: () => Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY),
  trigger: () => Boolean(env.TRIGGER_SECRET_KEY),
  hubspot: () => Boolean(env.HUBSPOT_CLIENT_ID && env.HUBSPOT_CLIENT_SECRET),
  slack: () => Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET),
  linear: () => Boolean(env.LINEAR_CLIENT_ID && env.LINEAR_CLIENT_SECRET),
  email: () => Boolean(env.RESEND_API_KEY),
  billing: () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  langfuse: () => Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY),
};
