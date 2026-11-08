import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { env, features } from "../lib/env";
import { badRequest, param } from "../lib/http";
import { signState, verifyState } from "../lib/crypto";
import { ADMIN, ctx, requireRole } from "../middleware/auth";
import { saveIntegration, serializeIntegration, getIntegration } from "../integrations/store";
import { hubspotAuthorizeUrl, hubspotExchangeCode, hubspotSearch } from "../integrations/hubspot";
import { slackAuthorizeUrl, slackExchangeCode, slackListChannels } from "../integrations/slack";
import { linearAuthorizeUrl, linearCreateIssue, linearExchangeCode, linearListTeams } from "../integrations/linear";

/** Authenticated routes (mounted under /api with requireWorkspace). */
export const integrationsRouter = Router();
/** OAuth callbacks (mounted under /api without session requirement — trust comes from the signed state). */
export const oauthCallbackRouter = Router();

type OAuthProvider = "hubspot" | "slack" | "linear";
const PROVIDERS: Record<OAuthProvider, { enum: "HUBSPOT" | "SLACK" | "LINEAR"; configured: () => boolean; authorize: (s: string) => string; exchange: (code: string) => Promise<{ creds: unknown; accountId?: string; accountName?: string }> }> = {
  hubspot: { enum: "HUBSPOT", configured: features.hubspot, authorize: hubspotAuthorizeUrl, exchange: hubspotExchangeCode },
  slack: { enum: "SLACK", configured: features.slack, authorize: slackAuthorizeUrl, exchange: slackExchangeCode },
  linear: { enum: "LINEAR", configured: features.linear, authorize: linearAuthorizeUrl, exchange: linearExchangeCode },
};

const providerParam = (req: Request) => {
  const p = param(req, "provider").toLowerCase() as OAuthProvider;
  if (!PROVIDERS[p]) throw badRequest("Unknown provider");
  return p;
};

integrationsRouter.get("/integrations", async (req, res) => {
  const { workspaceId } = ctx(req);
  const items = await prisma.integration.findMany({ where: { workspaceId } });
  res.json({
    items: items.map(serializeIntegration),
    available: {
      HUBSPOT: features.hubspot(),
      SLACK: features.slack(),
      LINEAR: features.linear(),
    },
  });
});

integrationsRouter.get("/integrations/:provider/authorize", requireRole(...ADMIN), (req, res) => {
  const { workspaceId, userId } = ctx(req);
  const p = providerParam(req);
  if (!PROVIDERS[p].configured()) throw badRequest(`${p} OAuth app is not configured on the server (.env)`);
  const state = signState({ workspaceId, userId, provider: p });
  res.json({ url: PROVIDERS[p].authorize(state) });
});

oauthCallbackRouter.get("/integrations/:provider/callback", async (req: Request, res: Response) => {
  const back = (q: string) => res.redirect(`${env.FRONTEND_URL}/app/connectors?${q}`);
  try {
    const p = providerParam(req);
    if (req.query.error) return back(`error=${encodeURIComponent(String(req.query.error_description ?? req.query.error))}`);
    const state = verifyState<{ workspaceId: string; userId: string; provider: string }>(String(req.query.state ?? ""));
    if (state.provider !== p) throw new Error("State/provider mismatch");
    const member = await prisma.member.findFirst({ where: { organizationId: state.workspaceId, userId: state.userId, role: { in: ["owner", "admin"] } } });
    if (!member) throw new Error("Not allowed");
    const { creds, accountId, accountName } = await PROVIDERS[p].exchange(String(req.query.code ?? ""));
    const existing = await prisma.integration.findUnique({ where: { workspaceId_provider: { workspaceId: state.workspaceId, provider: PROVIDERS[p].enum } } });
    await saveIntegration({
      workspaceId: state.workspaceId,
      provider: PROVIDERS[p].enum,
      credentials: creds,
      config: (existing?.config as Record<string, unknown>) ?? {},
      externalAccountId: accountId,
      externalAccountName: accountName,
      connectedById: state.userId,
    });
    back(`connected=${p}`);
  } catch (e) {
    console.error("[oauth callback]", e);
    back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Connection failed")}`);
  }
});

integrationsRouter.patch("/integrations/:provider/config", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const provider = param(req, "provider").toUpperCase() as "SLACK" | "LINEAR" | "HUBSPOT";
  const body = z
    .object({ channelId: z.string(), channelName: z.string(), teamId: z.string(), teamName: z.string() })
    .partial()
    .parse(req.body);
  const integ = await prisma.integration.findUnique({ where: { workspaceId_provider: { workspaceId, provider } } });
  if (!integ) throw badRequest("Not connected");
  const updated = await prisma.integration.update({
    where: { id: integ.id },
    data: { config: { ...((integ.config as object) ?? {}), ...body } },
  });
  res.json(serializeIntegration(updated));
});

integrationsRouter.delete("/integrations/:provider", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const provider = param(req, "provider").toUpperCase() as any;
  await prisma.integration.deleteMany({ where: { workspaceId, provider } });
  res.status(204).end();
});

integrationsRouter.get("/integrations/slack/channels", async (req, res) => {
  res.json({ items: await slackListChannels(ctx(req).workspaceId) });
});

integrationsRouter.get("/integrations/linear/teams", async (req, res) => {
  res.json({ items: await linearListTeams(ctx(req).workspaceId) });
});

integrationsRouter.get("/integrations/hubspot/lookup", async (req, res) => {
  const { workspaceId } = ctx(req);
  const email = req.query.email ? String(req.query.email) : null;
  const text = req.query.q ? String(req.query.q) : null;
  res.json(await hubspotSearch(workspaceId, { email, text }));
});

/** Quick connectivity test from the Connectors page. */
integrationsRouter.post("/integrations/:provider/test", requireRole(...ADMIN), async (req, res) => {
  const { workspaceId } = ctx(req);
  const provider = param(req, "provider").toUpperCase();
  if (provider === "SLACK") await slackListChannels(workspaceId);
  else if (provider === "LINEAR") await linearListTeams(workspaceId);
  else if (provider === "HUBSPOT") await hubspotSearch(workspaceId, { text: "test" });
  else throw badRequest("Unknown provider");
  res.json({ ok: true });
});

export { linearCreateIssue };
