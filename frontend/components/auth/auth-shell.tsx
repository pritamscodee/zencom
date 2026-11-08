import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden overflow-hidden bg-[#0b0f1a] p-12 text-white lg:flex lg:flex-col">
        <Link href="/" className="text-lg">
          <Logo tone="white" markClassName="size-8" wordClassName="text-[22px]" />
        </Link>
        <div className="mt-auto max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Your docs answer the easy questions. <span className="text-white/50">Your team handles the rest.</span>
          </p>
          <p className="mt-5 text-white/60">AI replies on your site, tickets for real issues, and a clean handoff when a person should step in.</p>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-[#0052f2]/30 blur-3xl" />
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block text-lg lg:hidden">
            <Logo markClassName="size-8" wordClassName="text-[22px]" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
