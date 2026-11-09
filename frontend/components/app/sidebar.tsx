"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Dropdown, Label, Separator } from "@heroui/react";
import { BookOpen, ChevronsUpDown, CreditCard, Inbox, LayoutDashboard, LogOut, Plug, Plus, Settings, Ticket, Users } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { authClient } from "@/lib/auth-client";
import { workspaceStore } from "@/lib/api";
import { initials, ROLE_LABEL } from "@/lib/format";
import { useRealtime, useWorkspace } from "./workspace-provider";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/tickets", label: "Tickets", icon: Ticket },
  { href: "/app/documents", label: "Document Hub", icon: BookOpen },
  { href: "/app/connectors", label: "Connectors", icon: Plug },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { info } = useWorkspace();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    authClient.organization.list().then((r) => setOrgs((r.data ?? []) as { id: string; name: string }[]));
  }, []);

  useRealtime("conversation:escalated", () => setPending((p) => p + 1));
  // Clear the escalation badge when the inbox is opened (adjusting state during render).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (pathname.startsWith("/app/inbox")) setPending(0);
  }

  async function switchWorkspace(id: string) {
    if (id === "__new") return router.push("/onboarding?new=1");
    await authClient.organization.setActive({ organizationId: id });
    workspaceStore.set(id);
    // Full reload on purpose: resets every workspace-scoped client cache and socket.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/app";
  }

  async function logout() {
    await authClient.signOut();
    workspaceStore.clear();
    router.replace("/login");
  }

  return (
    <aside className={`flex h-full w-64 shrink-0 flex-col border-r border-separator bg-surface lg:w-60 ${className}`}>
      <Link href="/app" className="flex h-14 items-center px-5" aria-label="Zencom home">
        <Logo markClassName="size-7" wordClassName="text-[19px]" />
      </Link>
      <div className="px-3 pb-3">
        <Dropdown>
          <Dropdown.Trigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-default/60">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
              {/* Workspace logos are arbitrary customer-hosted URLs, so next/image (allowlisted hosts) does not fit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {info.workspace.logo ? <img src={info.workspace.logo} alt="" className="size-8 rounded-lg object-cover" /> : initials(info.workspace.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{info.workspace.name}</span>
              <span className="block text-xs text-muted">{ROLE_LABEL[info.role]}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted" />
          </Dropdown.Trigger>
          <Dropdown.Popover className="min-w-56">
            <Dropdown.Menu onAction={(k) => switchWorkspace(String(k))}>
              {[
                ...orgs.map((o) => (
                  <Dropdown.Item key={o.id} id={o.id} textValue={o.name}>
                    <Label>{o.name}</Label>
                  </Dropdown.Item>
                )),
                <Dropdown.Item key="__new" id="__new" textValue="New workspace">
                  <Plus className="size-4" />
                  <Label>New workspace</Label>
                </Dropdown.Item>,
              ]}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                active ? "bg-accent/10 font-medium text-accent" : "text-foreground/75 hover:bg-default/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/app/inbox" && pending > 0 && (
                <span className="rounded-full bg-warning px-1.5 text-[11px] font-semibold text-warning-foreground">{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />
      <div className="flex items-center gap-2.5 p-3">
        <Avatar size="sm">
          {info.user.image ? <Avatar.Image src={info.user.image} alt={info.user.name} /> : null}
          <Avatar.Fallback>{initials(info.user.name)}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{info.user.name}</div>
          <div className="truncate text-xs text-muted">{info.user.email}</div>
        </div>
        <button onClick={logout} className="rounded-md p-1.5 text-muted hover:bg-default/60 hover:text-foreground" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-5 pb-3 text-[11px] text-muted">
        <LogoMark className="size-3.5" /> Powered by Zencom
      </div>
    </aside>
  );
}
