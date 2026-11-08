import { env } from "../lib/env";
import { getIntegration } from "./store";

export const linearRedirectUri = () => `${env.BACKEND_URL}/api/integrations/linear/callback`;

export function linearAuthorizeUrl(state: string) {
  const u = new URL("https://linear.app/oauth/authorize");
  u.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
  u.searchParams.set("redirect_uri", linearRedirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "read,write,issues:create");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

async function gql<T = any>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json();
  if (json.errors?.length) throw new Error(`Linear: ${json.errors[0].message}`);
  return json.data;
}

export async function linearExchangeCode(code: string) {
  const res = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      redirect_uri: linearRedirectUri(),
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
      grant_type: "authorization_code",
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Linear OAuth error: ${json.error_description ?? json.error ?? res.statusText}`);
  const accessToken = json.access_token as string;
  const data = await gql(accessToken, `query { organization { id name } }`);
  return {
    creds: {
      accessToken,
      refreshToken: json.refresh_token as string | undefined,
      expiresAt: json.expires_in ? Date.now() + Number(json.expires_in) * 1000 : undefined,
    },
    accountId: data.organization.id as string,
    accountName: data.organization.name as string,
  };
}

export async function linearListTeams(workspaceId: string) {
  const found = await getIntegration(workspaceId, "LINEAR");
  if (!found) throw new Error("Linear is not connected");
  const data = await gql(found.credentials.accessToken, `query { teams(first: 100) { nodes { id name key } } }`);
  return data.teams.nodes as { id: string; name: string; key: string }[];
}

const PRIORITY: Record<string, number> = { URGENT: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };

export async function linearCreateIssue(
  workspaceId: string,
  ticket: { number: number; title: string; description: string; priority: string; category: string; customer?: string | null; url: string },
  teamOverride?: string,
) {
  const found = await getIntegration(workspaceId, "LINEAR");
  if (!found) throw new Error("Linear is not connected");
  const teamId = teamOverride || found.config.teamId;
  if (!teamId) throw new Error("Select a default Linear team in Connectors first");

  const description = [
    ticket.description,
    "",
    "---",
    `**Category:** ${ticket.category}`,
    `**Customer:** ${ticket.customer ?? "Unknown"}`,
    `**Zencom ticket:** [#${ticket.number}](${ticket.url})`,
  ].join("\n");

  const data = await gql(
    found.credentials.accessToken,
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
    { input: { teamId, title: ticket.title, description, priority: PRIORITY[ticket.priority] ?? 0 } },
  );
  if (!data.issueCreate.success) throw new Error("Linear issue creation failed");
  return data.issueCreate.issue as { id: string; identifier: string; url: string };
}
