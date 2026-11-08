"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sidebar } from "./sidebar";

/** Responsive dashboard frame: fixed sidebar on desktop, slide-in drawer + top bar on tablet/mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Drawer (tablet / mobile) */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <div className={`absolute inset-y-0 left-0 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator bg-surface px-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-default/60" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Logo markClassName="size-6" wordClassName="text-[17px]" />
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
