import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { prisma } from "./db";
import { env } from "./env";
import { ensureWorkspaceSettings } from "../services/workspace";
import { invitationEmail, sendEmail } from "./email";
import { HttpError } from "./http";

/**
 * Workspace = Better Auth organization.
 * Roles: owner / admin / member ("member" is shown as "Agent" in the UI).
 */
export const auth = betterAuth({
  baseURL: env.BACKEND_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [env.FRONTEND_URL],
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 24 * 7,
      // Plan seat limit (members). Pending invites are checked in beforeCreateInvitation.
      membershipLimit: async (_user, org) => {
        const { getPlan } = await import("../services/billing");
        return (await getPlan(org.id)).limits.seats;
      },
      /**
       * Sent on invite and on "Resend" (inviteMember with resend: true). Delivery failures are logged, not thrown,
       * so the invitation still exists and the dashboard's copy-link fallback keeps working.
       */
      async sendInvitationEmail(data) {
        const url = `${env.FRONTEND_URL}/accept-invite/${data.id}`;
        const mail = invitationEmail({
          inviterName: data.inviter.user.name,
          inviterEmail: data.inviter.user.email,
          workspaceName: data.organization.name,
          role: data.role,
          url,
          expiresAt: new Date(data.invitation.expiresAt),
        });
        const result = await sendEmail({
          to: data.email,
          ...mail,
          replyTo: data.inviter.user.email,
          // Same invite + same expiry = same email; a resend extends expiry, so it gets a new key.
          idempotencyKey: `invite-${data.id}-${new Date(data.invitation.expiresAt).getTime()}`,
        });
        if (result.sent) console.log(`[invite] emailed ${data.email} (${result.id})`);
        else console.warn(`[invite] email not sent to ${data.email}: ${result.reason}. Link: ${url}`);
      },
      organizationHooks: {
        async beforeCreateInvitation({ invitation }) {
          // Resends of an existing pending invite don't consume a new seat.
          const existing = await prisma.invitation.findFirst({
            where: { organizationId: invitation.organizationId, email: invitation.email.toLowerCase(), status: "pending" },
          });
          if (existing) return;
          const { assertSeatAvailable } = await import("../services/billing");
          try {
            await assertSeatAvailable(invitation.organizationId);
          } catch (e) {
            if (e instanceof HttpError) throw new APIError("PAYMENT_REQUIRED", { message: e.message });
            throw e;
          }
        },
        async afterCreateOrganization({ organization }) {
          await ensureWorkspaceSettings(organization.id, organization.name);
        },
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
