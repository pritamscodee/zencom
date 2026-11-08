"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Spinner } from "@heroui/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import { workspaceStore } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/format";

type Invite = { id: string; email: string; role: string; organizationName: string; inviterEmail: string; organizationId: string };

export default function AcceptInvitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = authClient.useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.isPending || !session.data) return;
    authClient.organization.getInvitation({ query: { id } }).then(({ data, error }) => {
      if (error || !data) setError(error?.message ?? "This invitation is invalid or has expired.");
      else setInvite(data as unknown as Invite);
    });
  }, [id, session.isPending, session.data]);

  async function accept() {
    setLoading(true);
    const { error } = await authClient.organization.acceptInvitation({ invitationId: id });
    if (error) {
      setLoading(false);
      return setError(error.message ?? "Could not accept invitation");
    }
    if (invite) {
      await authClient.organization.setActive({ organizationId: invite.organizationId });
      workspaceStore.set(invite.organizationId);
    }
    router.replace("/app");
  }

  if (session.isPending) {
    return (
      <AuthShell title="Join workspace">
        <Spinner />
      </AuthShell>
    );
  }

  if (!session.data) {
    return (
      <AuthShell title="You're invited to Zencom" subtitle="Sign in or create an account with the invited email to join the workspace.">
        <div className="flex gap-3">
          <Link href={`/login?next=/accept-invite/${id}`} className="flex-1">
            <Button className="w-full" variant="secondary">
              Sign in
            </Button>
          </Link>
          <Link href={`/signup?invite=${id}`} className="flex-1">
            <Button className="w-full">Create account</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={invite ? `Join ${invite.organizationName}` : "Join workspace"}
      subtitle={invite ? `${invite.inviterEmail} invited you as ${ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL] ?? invite.role}.` : undefined}
    >
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !invite ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Signed in as <span className="font-medium text-foreground">{session.data.user.email}</span>
          </p>
          <Button className="w-full" onPress={accept} isPending={loading}>
            Accept invitation
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
