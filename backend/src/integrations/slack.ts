import { env } from "../lib/env";
import { getIntegration } from "./store";

const SCOPES = ["chat:write", "chat:write.public", "channels:read", "groups:read"];
export const slackRedirectUri = () => `${env.BACKEND_URL}/api/integrations/slack/callback`;

export function slackAuthorizeUrl(state: string) {
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  u.searchParams.set("scope", SCOPES.join(","));
  u.searchParams.set("redirect_uri", slackRedirectUri());
  u.searchParams.set("state", state);
  return u.toString();
}

export async function slackExchangeCode(code: string) {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: slackRedirectUri(),
    }),
  });
  const json: any = await res.json();
  if (!json.ok) throw new Error(`Slack OAuth error: ${json.error}`);
  return {
    creds: { accessToken: json.access_token as string, botUserId: json.bot_user_id },
    accountId: json.team?.id as string,
    accountName: json.team?.name as string,
  };
}

async function slack(token: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>) {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json();
  if (!json.ok) throw new Error(`Slack ${method}: ${json.error}`);
  return json;
}

export async function slackListChannels(workspaceId: string) {
  const found = await getIntegration(workspaceId, "SLACK");
  if (!found) throw new Error("Slack is not connected");
  const json = await slack(found.credentials.accessToken, "conversations.list", undefined, {
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "500",
  });
  return (json.channels ?? []).map((c: any) => ({ id: c.id, name: c.name, isPrivate: c.is_private }));
}

export async function slackPostTicket(
  workspaceId: string,
  ticket: { number: number; title: string; description: string; priority: string; category: string; status: string; customer?: string | null; url: string },
  channelOverride?: string,
) {
  const found = await getIntegration(workspaceId, "SLACK");
  if (!found) throw new Error("Slack is not connected");
  const channel = channelOverride || found.config.channelId;
  if (!channel) throw new Error("Select a default Slack channel in Connectors first");
  const priorityEmoji: Record<string, string> = { URGENT: ":rotating_light:", HIGH: ":red_circle:", MEDIUM: ":large_orange_circle:", LOW: ":white_circle:" };

  const json = await slack(found.credentials.accessToken, "chat.postMessage", {
    channel,
    text: `Ticket #${ticket.number}: ${ticket.title}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `#${ticket.number} · ${ticket.title}`.slice(0, 150) } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Priority*\n${priorityEmoji[ticket.priority] ?? ""} ${ticket.priority}` },
          { type: "mrkdwn", text: `*Category*\n${ticket.category}` },
          { type: "mrkdwn", text: `*Status*\n${ticket.status}` },
          { type: "mrkdwn", text: `*Customer*\n${ticket.customer ?? "Unknown"}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: ticket.description.slice(0, 2900) } },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "Open in Zencom" }, url: ticket.url }],
      },
    ],
  });
  const permalink = await slack(found.credentials.accessToken, "chat.getPermalink", undefined, { channel: json.channel, message_ts: json.ts })
    .then((p) => p.permalink as string)
    .catch(() => null);
  return { channel: json.channel as string, ts: json.ts as string, url: permalink };
}
