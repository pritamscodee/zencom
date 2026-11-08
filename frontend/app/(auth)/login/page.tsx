"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Spinner } from "@heroui/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) return setError(error.message ?? "Invalid email or password");
    router.replace(next.startsWith("/") ? next : "/app");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Work email" type="email" value={email} onChange={setEmail} autoComplete="email" isRequired placeholder="you@company.com" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" isRequired />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" isPending={loading}>
        {loading ? <Spinner size="sm" color="current" /> : null}
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Zencom workspace."
      footer={
        <>
          New to Zencom?{" "}
          <Link href="/signup" className="font-medium text-accent">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
