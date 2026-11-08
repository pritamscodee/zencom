import type { Customer, TicketPriority, TicketStatus, ConversationStatus } from "./types";

export function timeAgo(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function customerName(c: Pick<Customer, "name" | "email" | "phone" | "id"> | null | undefined) {
  if (!c) return "Unknown customer";
  return c.name || c.email || c.phone || `Visitor ${c.id.slice(-4).toUpperCase()}`;
}

export function initials(name: string) {
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Agent" } as const;

export const PRIORITY_META: Record<TicketPriority, { label: string; color: "danger" | "warning" | "accent" | "default" }> = {
  URGENT: { label: "Urgent", color: "danger" },
  HIGH: { label: "High", color: "warning" },
  MEDIUM: { label: "Medium", color: "accent" },
  LOW: { label: "Low", color: "default" },
};

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; color: "accent" | "warning" | "success" | "default" }> = {
  OPEN: { label: "Open", color: "accent" },
  IN_PROGRESS: { label: "In progress", color: "warning" },
  RESOLVED: { label: "Resolved", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

export const CONVO_STATUS_META: Record<ConversationStatus, { label: string; color: "accent" | "warning" | "success" }> = {
  OPEN: { label: "Open", color: "accent" },
  PENDING: { label: "Pending", color: "warning" },
  RESOLVED: { label: "Resolved", color: "success" },
};

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
