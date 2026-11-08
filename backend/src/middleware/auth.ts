import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";
import { forbidden, HttpError } from "../lib/http";

export type Role = "owner" | "admin" | "member";

export type RequestContext = {
  userId: string;
  user: { id: string; name: string; email: string; image?: string | null };
  sessionId: string;
  workspaceId: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

export const ctx = (req: Request): RequestContext => {
  if (!req.ctx) throw new HttpError(401, "Unauthorized");
  return req.ctx;
};

/**
 * Authenticates the Better Auth session and resolves the active workspace.
 * Workspace comes from the `x-workspace-id` header or the session's active organization,
 * and membership is always verified — this is the tenant isolation boundary.
 */
export async function requireWorkspace(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new HttpError(401, "Unauthorized");

    const requested = (req.header("x-workspace-id") || session.session.activeOrganizationId || "").trim();
    const member = requested
      ? await prisma.member.findFirst({ where: { userId: session.user.id, organizationId: requested } })
      : await prisma.member.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
    if (!member) throw new HttpError(requested ? 403 : 409, requested ? "Not a member of this workspace" : "No workspace");

    req.ctx = {
      userId: session.user.id,
      user: session.user,
      sessionId: session.session.id,
      workspaceId: member.organizationId,
      role: member.role as Role,
    };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.ctx || !roles.includes(req.ctx.role)) return next(forbidden("You don't have permission to do this"));
    next();
  };

export const ADMIN: Role[] = ["owner", "admin"];
