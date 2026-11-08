import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceProvider } from "@/components/app/workspace-provider";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: "Dashboard" };

// Authenticated, client-rendered dashboard: opt out of instant-navigation validation.
export const instant = false;

function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <WorkspaceProvider>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </Suspense>
  );
}
