import { Resend } from "resend";
import { env, features } from "./env";

let client: Resend | null = null;
const resend = () => (client ??= new Resend(env.RESEND_API_KEY));

export type SendEmailResult = { sent: true; id: string } | { sent: false; reason: string };

/** Transactional email via Resend. Never throws: callers decide what a failed send means. */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string }): Promise<SendEmailResult> {
  if (!features.email()) return { sent: false, reason: "RESEND_API_KEY not configured" };
  try {
    const { data, error } = await resend().emails.send(
      { from: env.EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo },
      msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : undefined,
    );
    if (error || !data) return { sent: false, reason: error?.message ?? "Unknown Resend error" };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function invitationEmail(p: { inviterName: string; inviterEmail: string; workspaceName: string; role: string; url: string; expiresAt: Date }) {
  const roleLabel = p.role === "admin" ? "an Admin" : p.role === "owner" ? "an Owner" : "an Agent";
  const expires = p.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const subject = `${p.inviterName} invited you to ${p.workspaceName} on Zencom`;
  const text = `${p.inviterName} (${p.inviterEmail}) invited you to join ${p.workspaceName} on Zencom as ${roleLabel}.

Accept the invitation: ${p.url}

This link expires on ${expires}. If you weren't expecting it, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1115">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e6e8ec">
<tr><td style="padding:32px 32px 8px"><div style="font-size:18px;font-weight:700;color:#0052f2">Zencom</div></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">Join ${esc(p.workspaceName)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3d424d"><b>${esc(p.inviterName)}</b> (${esc(p.inviterEmail)}) invited you to join <b>${esc(p.workspaceName)}</b> as ${roleLabel}.</p>
<a href="${esc(p.url)}" style="display:inline-block;background:#0052f2;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">Accept invitation</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280">Or paste this link into your browser:<br><a href="${esc(p.url)}" style="color:#0052f2;word-break:break-all">${esc(p.url)}</a></p></td></tr>
<tr><td style="padding:24px 32px 32px;font-size:12px;color:#8a909c">This invitation expires on ${expires}. If you weren't expecting it, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
