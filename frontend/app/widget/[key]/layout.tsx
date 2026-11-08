import { Suspense } from "react";

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="h-dvh bg-white" />}>{children}</Suspense>;
}
