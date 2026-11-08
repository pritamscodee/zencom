"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Spinner } from "@heroui/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { api, workspaceStore } from "@/lib/api";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const forceNew = params.get("new") === "1";
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data) {
      router.replace("/login?next=/onboarding");
      return;
    }
    if (forceNew) return setChecking(false);
    authClient.organization.list().then(async (r) => {
      const first = r.data?.[0];
      if (first) {
        await authClient.organization.setActive({ organizationId: first.id });
        workspaceStore.set(first.id);
        router.replace("/app");
      } else setChecking(false);
    });
  }, [session.isPending, session.data, router, forceNew]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const slug = `${slugify(name) || "workspace"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await authClient.organization.create({ name, slug });
    if (error || !data) {
      setLoading(false);
      return setError(error?.message ?? "Could not create workspace");
    }
    await authClient.organization.setActive({ organizationId: data.id });
    workspaceStore.set(data.id);
    await api("/api/workspace"); // ensures settings exist
    await api("/api/workspace/settings", {
      method: "PATCH",
      body: { businessName: name, website: website || null, businessDescription: description || null },
    }).catch(() => {});
    router.replace("/app?welcome=1");
  }

  if (checking) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Business name" value={name} onChange={setName} isRequired placeholder="Acme Inc." />
      <Field label="Website" value={website} onChange={setWebsite} placeholder="https://acme.com" />
      <Field
        label="What does your business do?"
        value={description}
        onChange={setDescription}
        placeholder="We sell eco-friendly running shoes online."
        description="Gives the AI agent context. You can change it later."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" isPending={loading}>
        {loading ? <Spinner size="sm" color="current" /> : null}
        Create workspace
      </Button>
    </form>
  );
}

export default function OnboardingPage() {
  return (
    <AuthShell title="Create your workspace" subtitle="A workspace holds your inbox, knowledge base, team and integrations.">
      <Suspense>
        <Onboarding />
      </Suspense>
    </AuthShell>
  );
}
