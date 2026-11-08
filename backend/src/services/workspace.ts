import { prisma } from "../lib/db";
import { randomToken } from "../lib/crypto";

export async function ensureWorkspaceSettings(workspaceId: string, businessName?: string) {
  const existing = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.workspaceSettings.create({
    data: { workspaceId, publicKey: `zc_${randomToken(16)}`, businessName: businessName ?? null },
  });
}

export async function getSettingsByPublicKey(publicKey: string) {
  return prisma.workspaceSettings.findUnique({
    where: { publicKey },
    include: { workspace: { select: { id: true, name: true, logo: true } } },
  });
}
