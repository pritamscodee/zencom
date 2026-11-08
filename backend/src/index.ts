import { shutdownObservability } from "./lib/observability"; // first: registers the OTel tracer provider
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { env, features } from "./lib/env";
import { errorHandler } from "./lib/http";
import { requireWorkspace } from "./middleware/auth";
import { workspaceRouter } from "./routes/workspace";
import { conversationsRouter } from "./routes/conversations";
import { ticketsRouter } from "./routes/tickets";
import { documentsRouter } from "./routes/documents";
import { integrationsRouter, oauthCallbackRouter } from "./routes/integrations";
import { membersRouter } from "./routes/members";
import { billingRouter } from "./routes/billing";
import { publicRouter } from "./routes/public";
import { webhooksRouter } from "./routes/webhooks";
import { createSocketServer } from "./socket";

const app = express();
app.set("trust proxy", 1);

// Public endpoints (widget config/script, webhooks) are open to any origin.
app.use(["/widget.js", "/api/public", "/webhooks"], cors({ origin: true }));
// Webhooks need the raw body for signature verification — mount before JSON parsing.
app.use(webhooksRouter);

// Dashboard API: credentialed CORS, only from the Zencom frontend.
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// Better Auth handles its own body parsing.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, features: Object.fromEntries(Object.entries(features).map(([k, f]) => [k, f()])) }));
app.use(publicRouter);
app.use("/api", oauthCallbackRouter);

const api = express.Router();
api.use(requireWorkspace);
api.use(workspaceRouter, conversationsRouter, ticketsRouter, documentsRouter, integrationsRouter, membersRouter, billingRouter);
app.use("/api", api);

app.use(errorHandler);

const server = createServer(app);
createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`⚡ Zencom API on ${env.BACKEND_URL}`);
  const missing = Object.entries(features)
    .filter(([, f]) => !f())
    .map(([k]) => k);
  if (missing.length) console.log(`   Not configured (features disabled / fallbacks used): ${missing.join(", ")}`);
});

// Flush buffered Langfuse spans/scores on shutdown so the last traces aren't lost.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, async () => {
    await shutdownObservability();
    process.exit(0);
  });
}
