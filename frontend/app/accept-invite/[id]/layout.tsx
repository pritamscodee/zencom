import { Suspense } from "react";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
