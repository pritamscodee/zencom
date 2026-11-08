import { prisma, type IntegrationProvider } from "../lib/db";
import { decryptJSON, encryptJSON } from "../lib/crypto";

export type OAuthCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  [k: string]: unknown;
};

export async function getIntegration<C = OAuthCredentials>(workspaceId: string, provider: IntegrationProvider) {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (!integration || integration.status !== "connected") return null;
  return { integration, credentials: decryptJSON<C>(integration.credentials), config: (integration.config ?? {}) as Record<string, any> };
}

export async function saveIntegration(params: {
  workspaceId: string;
  provider: IntegrationProvider;
  credentials: unknown;
  config?: Record<string, unknown>;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  connectedById?: string | null;
}) {
  const data = {
    status: "connected",
    credentials: encryptJSON(params.credentials),
    config: (params.config ?? {}) as any,
    externalAccountId: params.externalAccountId ?? null,
    externalAccountName: params.externalAccountName ?? null,
    connectedById: params.connectedById ?? null,
  };
  return prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: params.workspaceId, provider: params.provider } },
    create: { workspaceId: params.workspaceId, provider: params.provider, ...data },
    update: data,
  });
}

export async function updateCredentials(id: string, credentials: unknown) {
  await prisma.integration.update({ where: { id }, data: { credentials: encryptJSON(credentials) } });
}

/** Public-safe view of an integration (never exposes credentials). */
export function serializeIntegration(i: { id: string; provider: string; status: string; config: unknown; externalAccountName: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: i.id,
    provider: i.provider,
    status: i.status,
    config: i.config ?? {},
    externalAccountName: i.externalAccountName,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}
