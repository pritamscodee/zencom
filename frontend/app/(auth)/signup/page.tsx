"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Spinner } from "@heroui/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (error) return setError(error.message ?? "Could not create account");
    router.replace(invite ? `/accept-invite/${invite}` : "/onboarding");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name" value={name} onChange={setName} autoComplete="name" isRequired placeholder="Alex Morgan" />
      <Field label="Work email" type="email" value={email} onChange={setEmail} autoComplete="email" isRequired placeholder="you@company.com" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" isRequired description="At least 8 characters." />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" isPending={loading}>
        {loading ? <Spinner size="sm" color="current" /> : null}
        Create account
      </Button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up Zencom for your business in a few minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
