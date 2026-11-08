import { Bot, FileText, Globe, Send, Ticket } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { HubSpotLogo, LinearLogo } from "@/components/brand/integration-logos";

/** Coded product preview (no screenshots): Zencom inbox with an AI-handled conversation. */
export function ProductMock() {
  return (
    <div className="zc-mock overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-[0_40px_120px_-30px_rgba(0,26,79,0.45)]">
      <div className="flex items-center gap-1.5 border-b border-g10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-g20" />
        <span className="size-2.5 rounded-full bg-g20" />
        <span className="size-2.5 rounded-full bg-g20" />
        <span className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-g60"><LogoMark className="size-3.5" /> Zencom · Inbox</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr_230px]">
        {/* List */}
        <div className="hidden border-r border-g10 bg-g10/40 sm:block">
          {[
            { n: "Maya Chen", p: "Where is my order #4821?", ai: true, active: true },
            { n: "Tom Becker", p: "Can I change my delivery…", ai: true },
            { n: "Leo Martins", p: "The app crashes on login", ai: false, tag: "#112" },
            { n: "Priya S.", p: "Thanks, that worked!", ai: true },
          ].map((c) => (
            <div key={c.n} className={`border-b border-g10 px-3.5 py-3 ${c.active ? "bg-white" : ""}`}>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-black">
                <Globe className="size-3 text-brand" />
                <span className="truncate">{c.n}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-g60">{c.p}</div>
              <div className="mt-1.5 flex gap-1">
                {c.ai ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-medium text-brand">
                    <Bot className="size-2.5" /> AI
                  </span>
                ) : (
                  <span className="rounded-full bg-g10 px-1.5 py-px text-[10px] font-medium text-g70">Sam</span>
                )}
                {c.tag ? <span className="rounded-full bg-g10 px-1.5 py-px text-[10px] text-g60">{c.tag}</span> : null}
              </div>
            </div>
          ))}
        </div>

        {/* Thread */}
        <div className="flex min-h-[320px] flex-col sm:min-h-[360px]">
          <div className="border-b border-g10 px-4 py-2.5 text-[12px] font-semibold text-black">Maya Chen</div>
          <div className="flex-1 space-y-3 px-4 py-4 text-[12px] leading-relaxed">
            <div className="zc-msg flex">
              <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-g10 px-3 py-2 text-black">Hi! Where is my order #4821? It was supposed to arrive yesterday.</div>
            </div>
            <div className="zc-msg flex justify-end">
              <div className="max-w-[82%]">
                <div className="rounded-2xl rounded-tr-md bg-brand/10 px-3 py-2 text-black">
                  Sorry for the wait, Maya. Order #4821 left our warehouse on Monday. Standard shipping takes 3–5 business days, so it should arrive by Friday.
                  I&apos;ve opened a ticket so the team can check with the carrier.
                </div>
                <div className="mt-1 flex justify-end gap-1">
                  <span className="inline-flex items-center gap-1 rounded-md border border-g20 px-1.5 py-px text-[10px] text-g60">
                    <FileText className="size-2.5" /> shipping-policy.pdf
                  </span>
                  <span className="rounded-md border border-g20 px-1.5 py-px text-[10px] text-g60">92% confident</span>
                </div>
              </div>
            </div>
            <div className="zc-msg flex items-center justify-center gap-1 text-[10px] text-g60">
              <Ticket className="size-3" /> Ticket #118 created: Delayed delivery, order #4821
            </div>
          </div>
          <div className="m-3 flex items-center gap-2 rounded-xl border border-g20 px-3 py-2 text-[11px] text-g50">
            <span className="flex-1">Write a reply…</span>
            <Send className="size-3.5 text-brand" />
          </div>
        </div>

        {/* Side panel */}
        <div className="hidden border-l border-g10 p-4 text-[11px] lg:block">
          <div className="font-semibold text-black">Maya Chen</div>
          <div className="text-g60">maya@chen.studio</div>
          <div className="mt-4 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-g50"><HubSpotLogo className="size-3" /> HubSpot</div>
          <div className="mt-1.5 rounded-lg border border-g10 p-2.5">
            <div className="font-medium text-black">Customer · 6 orders</div>
            <div className="text-g60">Chen Studio</div>
          </div>
          <div className="zc-ticket mt-4 text-[10px] font-semibold uppercase tracking-wide text-g50">Ticket</div>
          <div className="zc-ticket mt-1.5 rounded-lg border border-g10 p-2.5">
            <div className="text-g60">#118 · shipping</div>
            <div className="font-medium text-black">Delayed delivery</div>
            <div className="mt-2 flex gap-1">
              <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">Approve</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-g20 px-1.5 py-0.5 text-[10px] text-black"><LinearLogo className="size-2.5" /> Send to Linear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
