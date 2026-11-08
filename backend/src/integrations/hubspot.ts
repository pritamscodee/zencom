import { env } from "../lib/env";
import { getIntegration, updateCredentials, type OAuthCredentials } from "./store";

const SCOPES = ["crm.objects.contacts.read", "crm.objects.companies.read", "oauth"];
export const hubspotRedirectUri = () => `${env.BACKEND_URL}/api/integrations/hubspot/callback`;

export function hubspotAuthorizeUrl(state: string) {
  const u = new URL("https://app.hubspot.com/oauth/authorize");
  u.searchParams.set("client_id", env.HUBSPOT_CLIENT_ID);
  u.searchParams.set("redirect_uri", hubspotRedirectUri());
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.HUBSPOT_CLIENT_ID,
      client_secret: env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: hubspotRedirectUri(),
      ...params,
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`HubSpot token error: ${json.message ?? res.statusText}`);
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresAt: Date.now() + (Number(json.expires_in) - 60) * 1000,
  } satisfies OAuthCredentials;
}

export async function hubspotExchangeCode(code: string) {
  const creds = await tokenRequest({ grant_type: "authorization_code", code });
  const info: any = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${creds.accessToken}`).then((r) => r.json());
  return { creds, accountId: String(info.hub_id ?? ""), accountName: info.hub_domain ?? `Portal ${info.hub_id}` };
}

async function token(workspaceId: string) {
  const found = await getIntegration(workspaceId, "HUBSPOT");
  if (!found) return null;
  let { credentials } = found;
  if (credentials.expiresAt && credentials.expiresAt < Date.now() && credentials.refreshToken) {
    credentials = await tokenRequest({ grant_type: "refresh_token", refresh_token: credentials.refreshToken });
    await updateCredentials(found.integration.id, credentials);
  }
  return credentials.accessToken;
}

async function hs(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot API ${res.status}: ${json.message ?? res.statusText}`);
  return json;
}

const CONTACT_PROPS = ["firstname", "lastname", "email", "phone", "company", "jobtitle", "lifecyclestage", "hs_lead_status", "city", "country", "createdate", "notes_last_contacted"];

/**
 * Search the connected HubSpot portal. Data stays in HubSpot — nothing is copied into Zencom.
 */
export async function hubspotSearch(workspaceId: string, query: { email?: string | null; text?: string | null }) {
  const accessToken = await token(workspaceId);
  if (!accessToken) return { connected: false as const, contacts: [] };

  const body: any = { properties: CONTACT_PROPS, limit: 3 };
  if (query.email) body.filterGroups = [{ filters: [{ propertyName: "email", operator: "EQ", value: query.email }] }];
  else if (query.text) body.query = query.text;
  else return { connected: true as const, contacts: [] };

  const result = await hs(accessToken, "/crm/v3/objects/contacts/search", { method: "POST", body: JSON.stringify(body) });
  const contacts = await Promise.all(
    (result.results ?? []).map(async (c: any) => {
      let companies: any[] = [];
      try {
        const assoc = await hs(accessToken, `/crm/v4/objects/contacts/${c.id}/associations/companies`);
        const ids: string[] = (assoc.results ?? []).slice(0, 3).map((a: any) => String(a.toObjectId));
        companies = await Promise.all(
          ids.map((id) =>
            hs(accessToken, `/crm/v3/objects/companies/${id}?properties=name,domain,industry,numberofemployees,annualrevenue,lifecyclestage`).then((x) => x.properties),
          ),
        );
      } catch {
        /* company scope may be missing */
      }
      return { id: c.id, ...c.properties, companies };
    }),
  );
  return { connected: true as const, contacts };
}
