"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Chip, Dropdown, Label, Modal, toast } from "@heroui/react";
import { Copy, MoreHorizontal, Send, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useWorkspace } from "@/components/app/workspace-provider";
import { Field } from "@/components/ui/field";
import { Picker } from "@/components/ui/pickers";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { dateTime, errorMessage, initials, ROLE_LABEL } from "@/lib/format";
import type { Invitation, MemberRow, Role } from "@/lib/types";

type Activity = { id: string; message: string; createdAt: string; actor: { name: string } | null; ticket: { id: string; number: number; title: string } };

export default function TeamPage() {
  const { info, isAdmin, reloadMembers } = useWorkspace();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const emailEnabled = info.features.email;

  const load = useCallback(
    () =>
      Promise.all([api<{ members: MemberRow[]; invitations: Invitation[] }>("/api/members"), api<{ items: Activity[] }>("/api/activity")]).then(([m, a]) => {
        setMembers(m.members);
        setInvitations(m.invitations);
        setActivity(a.items);
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const inviteLink = (id: string) => `${window.location.origin}/accept-invite/${id}`;

  async function invite() {
    setSending(true);
    const { data, error } = await authClient.organization.inviteMember({ email, role: role as "member" | "admin" | "owner", organizationId: info.workspace.id });
    setSending(false);
    if (error) return toast.danger("Invite failed", { description: error.message });
    if (data?.id) {
      if (emailEnabled) {
        toast.success("Invitation sent", { description: `We emailed ${email} a link to join. You can also copy the link from Pending invitations.` });
      } else {
        await navigator.clipboard.writeText(inviteLink(data.id)).catch(() => {});
        toast.success("Invitation created", { description: "Invite link copied to clipboard — share it with your teammate." });
      }
    }
    setInviteOpen(false);
    setEmail("");
    load();
  }

  async function memberAction(m: MemberRow, key: string) {
    try {
      if (key === "remove") {
        if (!confirm(`Remove ${m.user.name} from the workspace?`)) return;
        const { error } = await authClient.organization.removeMember({ memberIdOrEmail: m.id, organizationId: info.workspace.id });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.organization.updateMemberRole({ memberId: m.id, role: key as "member" | "admin" | "owner", organizationId: info.workspace.id });
        if (error) throw new Error(error.message);
      }
      toast.success("Member updated");
      load();
      reloadMembers();
    } catch (e) {
      toast.danger("Action failed", { description: errorMessage(e) });
    }
  }

  /** Re-sends the email and extends the invite's expiry (Better Auth `resend: true`). */
  async function resendInvite(i: Invitation) {
    setResending(i.id);
    const { error } = await authClient.organization.inviteMember({
      email: i.email,
      role: i.role as "member" | "admin" | "owner",
      organizationId: info.workspace.id,
      resend: true,
    });
    setResending(null);
    if (error) return toast.danger("Could not resend", { description: error.message });
    toast.success("Invitation resent", { description: `A fresh link was emailed to ${i.email}.` });
    load();
  }

  async function cancelInvite(id: string) {
    await authClient.organization.cancelInvitation({ invitationId: id });
    load();
  }

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader
        title="Team"
        description="Invite agents and admins, manage roles, and see who owns what."
        actions={
          isAdmin ? (
            <Button onPress={() => setInviteOpen(true)}>
              <UserPlus className="size-4" /> Invite
            </Button>
          ) : null
        }
      />
      <div className="grid gap-8 px-4 sm:px-6 lg:px-8 py-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-separator">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-default/40 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 text-right font-medium">Open convos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Open tickets</th>
                  <th className="px-4 py-2.5 text-right font-medium">Replies (7d)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Resolved (7d)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-separator">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          {m.user.image ? <Avatar.Image src={m.user.image} alt={m.user.name} /> : null}
                          <Avatar.Fallback>{initials(m.user.name)}</Avatar.Fallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {m.user.name} {m.user.id === info.user.id ? <span className="text-muted">(you)</span> : null}
                          </div>
                          <div className="text-xs text-muted">{m.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Chip size="sm" variant="soft" color={m.role === "owner" ? "accent" : "default"}>
                        {ROLE_LABEL[m.role]}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.stats.openConversations}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.stats.openTickets}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.stats.replies7d}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.stats.resolvedTickets7d}</td>
                    <td className="px-2 py-3 text-right">
                      {isAdmin && m.user.id !== info.user.id && m.role !== "owner" ? (
                        <Dropdown>
                          <Button isIconOnly size="sm" variant="ghost" aria-label="Member actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                          <Dropdown.Popover>
                            <Dropdown.Menu onAction={(k) => memberAction(m, String(k))}>
                              <Dropdown.Item id="admin" textValue="Make admin">
                                <Label>Make admin</Label>
                              </Dropdown.Item>
                              <Dropdown.Item id="member" textValue="Make agent">
                                <Label>Make agent</Label>
                              </Dropdown.Item>
                              <Dropdown.Item id="remove" textValue="Remove" variant="danger">
                                <Label>Remove from workspace</Label>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invitations.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Pending invitations</h2>
              <ul className="divide-y divide-separator rounded-xl border border-separator">
                {invitations.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{i.email}</div>
                      <div className="text-xs text-muted">
                        {ROLE_LABEL[i.role] ?? i.role} · expires {dateTime(i.expiresAt)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        navigator.clipboard.writeText(inviteLink(i.id));
                        toast("Invite link copied");
                      }}
                    >
                      <Copy className="size-3.5" /> Copy link
                    </Button>
                    {isAdmin && emailEnabled ? (
                      <Button size="sm" variant="secondary" isPending={resending === i.id} onPress={() => resendInvite(i)}>
                        <Send className="size-3.5" /> Resend
                      </Button>
                    ) : null}
                    {isAdmin ? (
                      <Button size="sm" variant="ghost" onPress={() => cancelInvite(i.id)}>
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl bg-default/40 p-4 text-xs text-muted">
            <b className="text-foreground">Roles.</b> Owner: everything, including deleting the workspace. Admin: settings, connectors, documents and members. Agent: inbox and tickets.
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold">Team activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">No ticket activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <div>
                    <span className="font-medium">{a.actor?.name ?? "Zencom AI"}</span> <span className="text-muted">·</span>{" "}
                    <a href={`/app/tickets/${a.ticket.id}`} className="text-accent">
                      #{a.ticket.number}
                    </a>{" "}
                    {a.message}
                  </div>
                  <div className="text-xs text-muted">{dateTime(a.createdAt)}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Modal.Backdrop isOpen={inviteOpen} onOpenChange={setInviteOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Invite a teammate</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} isRequired placeholder="teammate@company.com" />
              <Picker
                label="Role"
                value={role}
                onChange={(v) => setRole((v as Role) ?? "member")}
                options={[
                  { id: "member", label: "Agent — inbox & tickets" },
                  { id: "admin", label: "Admin — full workspace management" },
                ]}
              />
              <p className="text-xs text-muted">
                {emailEnabled
                  ? "We'll email them a link to join. It expires in 7 days; you can resend it anytime."
                  : "No email service is configured (RESEND_API_KEY), so you'll get an invite link to share."}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" slot="close">
                Cancel
              </Button>
              <Button onPress={invite} isPending={sending} isDisabled={!email.includes("@")}>
                {emailEnabled ? "Send invite" : "Create invite"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
