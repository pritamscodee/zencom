"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Bot, BookOpen, Check, FileUp, Inbox, MessageCircle, Search, Send, Ticket, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { HubSpotLogo, LinearLogo, SlackLogo } from "@/components/brand/integration-logos";
import { ProductMock } from "./product-mock";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS = [
  { icon: FileUp, title: "Upload what you know", text: "Drop in your FAQ, policies and product guides. Zencom indexes them for your workspace only." },
  { icon: MessageCircle, title: "Customers ask anywhere", text: "Questions arrive from your website chat into one shared inbox." },
  { icon: Bot, title: "The AI answers or opens a ticket", text: "It replies from your docs, checks HubSpot for account context, and logs real issues as tickets." },
  { icon: UserRound, title: "Your team steps in when it counts", text: "Low confidence? It hands off. Approve a fix, or send the ticket to Slack or Linear." },
];

const FEATURES = [
  {
    id: "inbox",
    icon: Inbox,
    label: "Shared inbox",
    title: "Every conversation, one place.",
    text: "Every website chat lands in one shared inbox. Assign, take over from the AI, leave internal notes, and resolve. Updates appear in real time.",
    points: ["Open, Pending and Resolved views", "Take over from the AI in one click", "Internal notes your customers never see"],
  },
  {
    id: "tickets",
    icon: Ticket,
    label: "Automatic tickets",
    title: "Issues become tickets on their own.",
    text: "When a customer reports a bug, a billing problem or a delay, the AI writes the ticket for you: title, description, priority and category. One conversation never creates duplicate tickets.",
    points: ["Approve the AI's proposed fix and send it", "Send to Slack or Linear", "Full activity history on every ticket"],
  },
  {
    id: "docs",
    icon: BookOpen,
    label: "Document Hub",
    title: "Answers grounded in your content.",
    text: "Upload PDFs, DOCX and text. Zencom chunks, embeds and indexes them. Replace a file and it re-indexes. The AI cites which document it used.",
    points: ["PDF, DOCX, TXT, Markdown, HTML", "Separate knowledge per workspace", "Test retrieval before customers do"],
  },
  {
    id: "crm",
    icon: Search,
    label: "CRM context",
    title: "Knows the customer. Copies nothing.",
    text: "Connect HubSpot and the AI looks up contacts and companies when account details matter. Your CRM stays the source of truth. Nothing gets copied into Zencom.",
    points: ["Live HubSpot lookups", "Personal answers, not canned ones", "Respects workspace integration settings"],
  },
];

const INTEGRATIONS = [
  { name: "HubSpot", text: "Customer and company context on demand.", Logo: HubSpotLogo },
  { name: "Slack", text: "Ticket alerts in the channel your team watches.", Logo: SlackLogo },
  { name: "Linear", text: "Support tickets become engineering issues.", Logo: LinearLogo },
];

function PrimaryCta({ children, href = "/signup", dark }: { children: React.ReactNode; href?: string; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] ${
        dark ? "bg-white text-black hover:bg-g10" : "bg-brand text-white hover:bg-[#0046cf]"
      }`}
    >
      {children}
    </Link>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(FEATURES[0]!.id);
  const feature = FEATURES.find((f) => f.id === tab)!;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero: words rise in, then supporting copy and CTAs.
        const hero = gsap.timeline({ defaults: { ease: "power3.out" } });
        hero
          .from(".zc-word", { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.06 })
          .from(".zc-hero-sub", { y: 16, opacity: 0, duration: 0.7 }, "-=0.5")
          .from(".zc-hero-cta", { y: 12, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.45")
          .from(".zc-mock-wrap", { y: 60, opacity: 0, scale: 0.97, duration: 1.1 }, "-=0.4");

        // Product demo plays as it scrolls into view.
        gsap
          .timeline({ scrollTrigger: { trigger: ".zc-mock-wrap", start: "top 70%" } })
          .from(".zc-msg", { y: 14, opacity: 0, duration: 0.5, stagger: 0.55, ease: "power2.out" })
          .from(".zc-ticket", { x: 16, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.2");

        // Steps: progress line fills while cards reveal.
        gsap.from(".zc-step", {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: ".zc-steps", start: "top 75%" },
        });
        gsap.fromTo(
          ".zc-progress",
          { scaleX: 0 },
          { scaleX: 1, ease: "none", scrollTrigger: { trigger: ".zc-steps", start: "top 70%", end: "bottom 60%", scrub: true } },
        );

        gsap.utils.toArray<HTMLElement>(".zc-reveal").forEach((el) => {
          gsap.from(el, { y: 36, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 82%" } });
        });

        gsap.from(".zc-int", {
          y: 24,
          opacity: 0,
          duration: 0.6,
          stagger: 0.07,
          ease: "power2.out",
          scrollTrigger: { trigger: ".zc-ints", start: "top 80%" },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Animate feature panel on tab change.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(".zc-feature-panel", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" });
    },
    { scope: root, dependencies: [tab] },
  );

  const headline = [
    { w: "Answers", dim: false },
    { w: "from", dim: true },
    { w: "your", dim: true },
    { w: "docs.", dim: false },
    { br: true },
    { w: "Handoffs", dim: false },
    { w: "to", dim: true },
    { w: "your", dim: true },
    { w: "team.", dim: false },
  ];

  return (
    <div ref={root} className="font-display bg-white text-black">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
          <Link href="/" className="text-[19px]" aria-label="Zencom home">
            <Logo markClassName="size-8" wordClassName="text-[21px]" />
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-g80 md:flex">
            <a href="#how" className="hover:text-black">How it works</a>
            <a href="#product" className="hover:text-black">Product</a>
            <a href="#integrations" className="hover:text-black">Integrations</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-[14px] font-medium text-g80 hover:text-black sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#0046cf]">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,82,242,0.10),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center md:pt-28">
          <p className="zc-hero-sub text-[14px] font-semibold text-brand">AI support agent + shared inbox</p>
          <h1 className="mt-5 text-[44px] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[56px] md:text-[64px] md:leading-[70px]">
            {headline.map((t, i) =>
              "br" in t ? (
                <br key={i} className="hidden sm:block" />
              ) : (
                <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                  <span className={`zc-word inline-block ${t.dim ? "text-g40" : "text-black"}`}>{t.w}&nbsp;</span>
                </span>
              ),
            )}
          </h1>
          <p className="zc-hero-sub mx-auto mt-6 max-w-2xl text-[18px] leading-[27px] text-g70 md:text-[20px]">
            Zencom answers customers on your website using your own content. It opens tickets for real problems and brings in a person when the answer isn&apos;t clear.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <span className="zc-hero-cta">
              <PrimaryCta>
                Start free <ArrowRight className="size-4" />
              </PrimaryCta>
            </span>
            <a href="#how" className="zc-hero-cta inline-flex h-12 items-center rounded-lg border border-g20 bg-white px-6 text-[16px] font-medium text-[#1e2024] transition-colors hover:bg-g10">
              See how it works
            </a>
          </div>
          <p className="zc-hero-cta mt-4 flex items-center justify-center gap-1.5 text-[14px] font-medium text-g60">
            <Check className="size-4 text-brand" /> One script tag to install. Bring your own docs.
          </p>
          <div className="zc-hero-cta mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] font-medium text-g60">
            <span>Works with</span>
            {INTEGRATIONS.map((i) => (
              <span key={i.name} className="inline-flex items-center gap-2 text-g80">
                <i.Logo className="size-5" /> {i.name}
              </span>
            ))}
          </div>
        </div>

        <div id="product" className="zc-mock-wrap relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="rounded-[28px] bg-gradient-to-b from-[#0052f2] to-[#001a4f] p-3 sm:p-6 md:p-10">
            <ProductMock />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-g10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="zc-reveal max-w-3xl">
            <p className="text-[14px] font-semibold text-brand">How it works</p>
            <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[56px] md:leading-[62px]">
              <span className="text-g50">Four steps.</span> No new CRM to migrate.
            </h2>
          </div>
          <div className="zc-steps relative mt-16">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-g20 lg:block" />
            <div className="zc-progress absolute left-0 right-0 top-6 hidden h-px origin-left bg-brand lg:block" />
            <ol className="grid gap-6 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="zc-step relative">
                  <div className="relative z-10 flex size-12 items-center justify-center rounded-full border border-g20 bg-white">
                    <s.icon className="size-5 text-brand" />
                  </div>
                  <div className="mt-6 text-[12px] font-semibold text-g60">Step {i + 1}</div>
                  <h3 className="mt-1 text-[22px] font-medium leading-[26px]">{s.title}</h3>
                  <p className="mt-2 text-[16px] leading-[22px] text-g70">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="zc-reveal max-w-3xl">
            <p className="text-[14px] font-semibold text-brand">The product</p>
            <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[56px] md:leading-[62px]">
              What if the boring questions <span className="text-g50">answered themselves?</span>
            </h2>
          </div>

          <div className="zc-reveal mt-12 flex flex-wrap gap-2" role="tablist" aria-label="Product features">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={tab === f.id}
                onClick={() => setTab(f.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-medium transition-colors ${
                  tab === f.id ? "bg-black text-white" : "bg-g10 text-g80 hover:bg-g20"
                }`}
              >
                <f.icon className="size-4" /> {f.label}
              </button>
            ))}
          </div>

          <div className="zc-feature-panel mt-8 grid items-center gap-10 rounded-3xl border border-g20 p-6 md:p-12 lg:grid-cols-2" role="tabpanel">
            <div>
              <h3 className="text-[28px] font-semibold leading-[31px] md:text-[36px] md:leading-[40px]">{feature.title}</h3>
              <p className="mt-4 text-[18px] leading-[24px] text-g70">{feature.text}</p>
              <ul className="mt-6 space-y-3">
                {feature.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[16px]">
                    <Check className="mt-0.5 size-5 shrink-0 text-brand" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <FeatureVisual id={feature.id} />
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="border-t border-g10 bg-white py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="zc-reveal grid gap-8 lg:grid-cols-2 lg:items-end">
            <h2 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[56px] md:leading-[62px]">
              Works with the tools <span className="text-g50">you already use.</span>
            </h2>
            <p className="text-[18px] leading-[24px] text-g70 lg:pb-2">
              Connect with OAuth in a click. Tokens are encrypted and kept per workspace. Disconnect anytime.
            </p>
          </div>
          <div className="zc-ints mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="zc-int rounded-2xl border border-g20 p-6 transition-colors hover:border-g40">
                <span className="flex size-12 items-center justify-center rounded-xl border border-g20 bg-white">
                  <i.Logo className="size-7" />
                </span>
                <div className="mt-6 text-[22px] font-medium">{i.name}</div>
                <p className="mt-1.5 text-[16px] leading-[22px] text-g70">{i.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-g100 py-24 text-white md:py-32">
        <div className="zc-reveal mx-auto max-w-4xl px-6 text-center">
          <p className="text-[14px] font-semibold text-brand-light">Start in minutes</p>
          <h2 className="mt-4 text-[40px] font-bold leading-[1.08] tracking-[-0.02em] md:text-[64px] md:leading-[70px]">
            Let the AI handle the repeats. <span className="text-white/45">Keep the hard ones for people.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[18px] leading-[24px] text-g40">Create a workspace, upload a few docs, and paste one script tag. Your first AI reply can be live today.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <PrimaryCta dark>
              Create your workspace <ArrowRight className="size-4" />
            </PrimaryCta>
            <Link href="/login" className="inline-flex h-12 items-center rounded-lg border border-white/20 px-6 text-[16px] font-medium text-white hover:bg-white/10">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-g100 pb-10 text-g50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 pt-8 text-[14px]">
          <Logo tone="white" markClassName="size-7" wordClassName="text-[18px]" />
          <span>© 2026 Zencom. AI customer support for growing teams.</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureVisual({ id }: { id: string }) {
  if (id === "tickets") {
    return (
      <div className="rounded-2xl bg-g10 p-6">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[12px] text-g60">
            #118 · shipping <span className="inline-flex items-center gap-1 text-brand"><Bot className="size-3" /> Created by AI</span>
          </div>
          <div className="mt-1 text-[18px] font-semibold">Delayed delivery, order #4821</div>
          <p className="mt-2 text-[14px] leading-[19px] text-g70">Customer reports order shipped Monday has not arrived. Expected delivery passed. Customer has placed 6 orders before.</p>
          <div className="mt-4 rounded-lg border border-brand/25 bg-brand/5 p-3 text-[13px]">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">Proposed resolution</div>
            Carrier confirms delivery Friday. Offer free express shipping on next order.
          </div>
          <div className="mt-4 flex gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-medium text-white"><Check className="size-3.5" /> Approve & resolve</span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-g20 px-3 text-[13px] font-medium"><Send className="size-3.5" /> Send to</span>
          </div>
        </div>
      </div>
    );
  }
  if (id === "docs") {
    return (
      <div className="space-y-2.5 rounded-2xl bg-g10 p-6">
        {[
          ["return-policy.pdf", "Ready · 14 chunks"],
          ["shipping-faq.docx", "Ready · 9 chunks"],
          ["product-guide.md", "Indexing…"],
        ].map(([n, s]) => (
          <div key={n} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
            <BookOpen className="size-4 text-brand" />
            <span className="flex-1 text-[14px] font-medium">{n}</span>
            <span className={`text-[12px] ${s.startsWith("Ready") ? "text-g60" : "text-brand"}`}>{s}</span>
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-g30 px-4 py-5 text-center text-[13px] text-g60">Drop PDF, DOCX or text files</div>
      </div>
    );
  }
  if (id === "crm") {
    return (
      <div className="rounded-2xl bg-g10 p-6">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-g50">HubSpot lookup</div>
          <div className="mt-2 text-[18px] font-semibold">Maya Chen</div>
          <div className="text-[14px] text-g60">Design Lead · Chen Studio</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-lg bg-g10 p-2.5"><div className="text-g60">Lifecycle</div><div className="font-medium">Customer</div></div>
            <div className="rounded-lg bg-g10 p-2.5"><div className="text-g60">Orders</div><div className="font-medium">6</div></div>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-brand/10 px-4 py-3 text-[13px] text-black">
          <Bot className="mr-1.5 inline size-3.5 text-brand" /> &ldquo;Thanks for being with us since your first order, Maya…&rdquo;
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-g10 p-6">
      {[
        { n: "Maya Chen", s: "AI handling", c: "bg-brand/10 text-brand" },
        { n: "Leo Martins", s: "Needs human", c: "bg-[#ff7d78]/20 text-[#a33a35]" },
        { n: "+44 7700 900123", s: "Assigned to Sam", c: "bg-g20 text-g80" },
      ].map((r) => (
        <div key={r.n} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <span className="flex size-8 items-center justify-center rounded-full bg-g10 text-[12px] font-semibold">{r.n.slice(0, 1)}</span>
          <span className="flex-1 text-[14px] font-medium">{r.n}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${r.c}`}>{r.s}</span>
        </div>
      ))}
    </div>
  );
}
