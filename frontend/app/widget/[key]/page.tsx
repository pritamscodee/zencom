"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Clock, FileText, Home, Mail, MessageSquare, Search, Sparkles, X } from "lucide-react";
import { API_URL } from "@/lib/config";
import { LogoMark } from "@/components/brand/logo";

/* ───────────────────────── types ───────────────────────── */

type WidgetConfig = {
  workspaceName: string;
  logo: string | null;
  color: string;
  greeting: string;
  aiName: string;
  aiEnabled: boolean;
  askForEmail: boolean;
  teamOnline: boolean;
  team: { name: string; image: string | null }[];
  helpEnabled: boolean;
};
type Role = "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
type WMessage = { id: string; conversationId: string; role: Role; content: string; createdAt: string; authorName?: string; authorImage?: string | null };
type ConvSummary = {
  id: string;
  status: "OPEN" | "PENDING" | "RESOLVED";
  lastMessageAt: string;
  lastMessage: WMessage | null;
  assignee: { name: string; image: string | null } | null;
  aiActive: boolean;
};
type View = { name: "home" | "messages" } | { name: "chat"; conversationId: string | null };
type HelpResult = { title: string; snippet: string; score: number };

/* ───────────────────────── helpers ───────────────────────── */

function visitorIdFor(key: string) {
  const k = `zencom.visitor.${key}`;
  let id = localStorage.getItem(k);
  if (!id) {
    id = `v_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(k, id);
  }
  return id;
}

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Mix the brand color with white for soft surfaces. */
const tint = (hex: string, pct: number) => `color-mix(in oklab, ${hex} ${pct}%, white)`;

/** Readable foreground for text sitting on the brand color (handles light brands like yellow or mint). */
function onBrand(hex: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // Contrast vs white = 1.05/(L+.05); vs ink(#13171a ≈ L .008) = (L+.05)/.058. Pick the higher.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.058 ? "#ffffff" : "#13171a";
}

function Avatar({ name, image, size = 32, ai, ring }: { name?: string; image?: string | null; size?: number; ai?: boolean; ring?: string }) {
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined };
  if (ai) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full" style={{ ...style, background: "var(--wc)", color: "var(--wc-fg)" }}>
        <Sparkles style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={2} />
      </span>
    );
  }
  // Avatars are arbitrary customer-hosted URLs, so next/image (allowlisted hosts) does not fit.
  // eslint-disable-next-line @next/next/no-img-element
  if (image) return <img src={image} alt={name ?? ""} className="shrink-0 rounded-full object-cover" style={style} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-[#13171a]" style={{ ...style, background: "var(--wc-soft)", fontSize: size * 0.4 }}>
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function BrandMark({ cfg, size = 36 }: { cfg: WidgetConfig; size?: number }) {
  // Workspace logos are arbitrary customer-hosted URLs, so next/image (allowlisted hosts) does not fit.
  // eslint-disable-next-line @next/next/no-img-element
  if (cfg.logo) return <img src={cfg.logo} alt={cfg.workspaceName} className="w-auto max-w-[132px] object-contain" style={{ height: size - 6 }} />;
  return (
    <span
      className="flex items-center justify-center rounded-[11px] font-display font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.44, background: "color-mix(in oklab, var(--wc-fg) 16%, transparent)", color: "var(--wc-fg)" }}
    >
      {cfg.workspaceName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function IconButton({ onClick, label, children, onBrandSurface }: { onClick: () => void; label: string; children: React.ReactNode; onBrandSurface?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`zc-icon-btn flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${onBrandSurface ? "zc-on-brand" : "text-[#50565b] hover:bg-[#f2f4f8] hover:text-[#13171a]"}`}
    >
      {children}
    </button>
  );
}

function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#868d95] transition-colors hover:text-[#373d42] ${className}`}
    >
      <LogoMark className="size-3" tone="current" /> Powered by <span className="font-semibold text-[#50565b]">zencom</span>
    </a>
  );
}

/* ───────────────────────── messenger ───────────────────────── */

export default function Messenger() {
  const { key } = useParams<{ key: string }>();
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<View>({ name: "home" });
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [messages, setMessages] = useState<Record<string, WMessage[]>>({});
  const [identity, setIdentity] = useState<{ name: string | null; email: string | null } | null>(null);
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [visible, setVisible] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);
  const inFrame = typeof window !== "undefined" && window.parent !== window;

  useEffect(() => {
    fetch(`${API_URL}/api/public/widget/${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c: WidgetConfig) => setCfg({ ...c, team: c.team ?? [], helpEnabled: Boolean(c.helpEnabled) }))
      .catch(() => setError(true));
  }, [key]);

  const refreshConversations = useCallback(() => {
    socketRef.current?.emit("conversations", {}, (r: { conversations: ConvSummary[] }) => setConversations(r.conversations ?? []));
  }, []);

  useEffect(() => {
    if (!cfg) return;
    const pageUrl = new URLSearchParams(window.location.search).get("page");
    const s = io(`${API_URL}/widget`, { auth: { publicKey: key, visitorId: visitorIdFor(key), pageUrl }, transports: ["websocket", "polling"] });
    socketRef.current = s;
    s.on("connect", () => {
      setSocket(s);
      s.emit("session", {}, (r: { customer: typeof identity; conversations: ConvSummary[] }) => {
        setIdentity(r.customer);
        setConversations(r.conversations ?? []);
      });
    });
    s.on("message:new", (m: WMessage) => {
      setMessages((prev) => {
        const list = prev[m.conversationId] ?? [];
        if (list.some((x) => x.id === m.id)) return prev;
        return { ...prev, [m.conversationId]: [...list, m] };
      });
      const v = viewRef.current;
      const viewing = v.name === "chat" && v.conversationId === m.conversationId;
      if (m.role !== "CUSTOMER" && (!viewing || document.hidden)) setUnread((u) => ({ ...u, [m.conversationId]: (u[m.conversationId] ?? 0) + 1 }));
      setTyping((t) => ({ ...t, [m.conversationId]: null }));
      refreshConversations();
    });
    s.on("typing", (t: { conversationId: string; role: string; typing: boolean; name?: string }) => {
      if (!t.conversationId) return;
      setTyping((prev) => ({ ...prev, [t.conversationId]: t.typing ? (t.role === "AI" ? cfg.aiName : t.name ?? "Support") : null }));
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [cfg, key, refreshConversations]);

  // Visibility from the host page (launcher open/close) + unread badge on the launcher.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "zencom:visibility") setVisible(Boolean(e.data.open));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (inFrame) window.parent.postMessage({ type: "zencom:unread", count: visible ? 0 : totalUnread }, "*");
  }, [totalUnread, visible, inFrame]);

  const openConversation = useCallback((conversationId: string | null) => {
    setView({ name: "chat", conversationId });
    if (!conversationId) return;
    setUnread((u) => ({ ...u, [conversationId]: 0 }));
    socketRef.current?.emit("open", { conversationId }, (r: { ok: boolean; messages: WMessage[] }) => {
      if (r.ok) setMessages((prev) => ({ ...prev, [conversationId]: r.messages }));
    });
  }, []);

  const close = () => inFrame && window.parent.postMessage({ type: "zencom:close" }, "*");

  if (error)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-white p-8 text-center">
        <MessageSquare className="size-6 text-[#9fa5ad]" />
        <div className="text-[15px] font-semibold text-[#13171a]">Chat is unavailable right now</div>
        <div className="text-[13px] text-[#697077]">Please refresh the page or try again in a few minutes.</div>
      </div>
    );
  if (!cfg) return <div className="h-dvh bg-white" />;

  const color = cfg.color;
  const fg = onBrand(color);
  const showTabs = view.name !== "chat";
  const chatId = view.name === "chat" ? view.conversationId : null;

  const vars = {
    "--wc": color,
    "--wc-fg": fg,
    "--wc-soft": tint(color, 16),
    "--wc-wash": tint(color, 5),
    "--wc-muted": `color-mix(in oklab, ${fg} 74%, ${color})`,
    // Brand as an accent on white: darkened for light brands so icons and links stay legible.
    "--wc-ink": fg === "#ffffff" ? color : `color-mix(in oklab, ${color} 45%, #13171a)`,
  } as React.CSSProperties;

  return (
    <div className="zc-root relative flex h-dvh flex-col overflow-hidden bg-white font-sans text-[#13171a] antialiased" style={vars}>
      <div key={view.name} className="zc-view flex min-h-0 flex-1 flex-col">
        {view.name === "home" ? (
          <HomeView cfg={cfg} conversations={conversations} unread={unread} onClose={inFrame ? close : undefined} onNew={() => openConversation(null)} onOpen={openConversation} apiKey={key} />
        ) : view.name === "messages" ? (
          <MessagesView cfg={cfg} conversations={conversations} unread={unread} onClose={inFrame ? close : undefined} onNew={() => openConversation(null)} onOpen={openConversation} />
        ) : (
          <ChatView
            cfg={cfg}
            socket={socket}
            conversationId={chatId}
            summary={conversations.find((c) => c.id === chatId) ?? null}
            messages={chatId ? messages[chatId] ?? [] : []}
            typing={chatId ? typing[chatId] ?? null : null}
            identity={identity}
            setIdentity={setIdentity}
            onBack={() => setView({ name: conversations.length > 0 ? "messages" : "home" })}
            onClose={inFrame ? close : undefined}
            onCreated={(id, first) => {
              setMessages((prev) => ({ ...prev, [id]: [...(prev[id] ?? []).filter((m) => m.id !== first.id), first] }));
              setView({ name: "chat", conversationId: id });
              refreshConversations();
            }}
            appendLocal={(id, m) => setMessages((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), m] }))}
            replaceLocal={(id, tempId, m) =>
              setMessages((prev) => {
                const list = (prev[id] ?? []).filter((x) => x.id !== tempId);
                return { ...prev, [id]: list.some((x) => x.id === m.id) ? list : [...list, m] };
              })
            }
          />
        )}
      </div>

      {showTabs ? (
        <nav className="grid grid-cols-2 gap-1 border-t border-[#eef0f4] bg-white px-3 pb-2.5 pt-2" aria-label="Messenger sections">
          {(
            [
              { id: "home", label: "Home", icon: Home },
              { id: "messages", label: "Messages", icon: MessageSquare },
            ] as const
          ).map((t) => {
            const active = view.name === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView({ name: t.id })}
                className={`relative flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-colors ${active ? "" : "text-[#697077] hover:bg-[#f6f7f9] hover:text-[#13171a]"}`}
                style={active ? { background: "var(--wc-wash)", color: "#13171a" } : undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <t.icon className="size-[18px]" strokeWidth={active ? 2.3 : 1.9} style={active ? { color: "var(--wc-ink)" } : undefined} />
                  {t.id === "messages" && totalUnread > 0 ? (
                    <span className="absolute -right-2.5 -top-2 min-w-[18px] rounded-full bg-[#e11d48] px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>
      ) : null}

      <style>{`
        .zc-root ::selection { background: var(--wc-soft); color: #13171a; }
        .zc-root textarea, .zc-root input { caret-color: var(--wc); }
        .zc-root :focus-visible:not(input):not(textarea) { outline: 2px solid var(--wc); outline-offset: 2px; border-radius: 10px; }
        .zc-brand :focus-visible { outline-color: var(--wc-fg); }
        .zc-on-brand { color: var(--wc-muted); }
        .zc-on-brand:hover { color: var(--wc-fg); background: color-mix(in oklab, var(--wc-fg) 14%, transparent); }
        .zc-brand {
          background-color: var(--wc);
          color: var(--wc-fg);
          background-image:
            radial-gradient(color-mix(in oklab, var(--wc-fg) 13%, transparent) 1px, transparent 1.2px),
            linear-gradient(160deg, color-mix(in oklab, var(--wc-fg) 10%, transparent), transparent 55%);
          background-size: 14px 14px, 100% 100%;
        }
        .zc-dots { -webkit-mask-image: linear-gradient(200deg, #000 0%, transparent 70%); mask-image: linear-gradient(200deg, #000 0%, transparent 70%); }
        .zc-view { animation: zc-in .32s cubic-bezier(.16,1,.3,1); }
        .zc-sheet { animation: zc-rise .5s cubic-bezier(.16,1,.3,1); }
        .zc-msg { animation: zc-pop .26s cubic-bezier(.16,1,.3,1); }
        @keyframes zc-in { from { opacity: .4; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes zc-rise { from { transform: translateY(18px); } to { transform: none; } }
        @keyframes zc-pop { from { opacity: .3; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .zc-view, .zc-sheet, .zc-msg { animation: none; } }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Home ───────────────────────── */

function HomeView({
  cfg,
  conversations,
  unread,
  onClose,
  onNew,
  onOpen,
  apiKey,
}: {
  cfg: WidgetConfig;
  conversations: ConvSummary[];
  unread: Record<string, number>;
  onClose?: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  apiKey: string;
}) {
  const recent = conversations.find((c) => c.status !== "RESOLVED") ?? null;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HelpResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const searchActive = Boolean(cfg.helpEnabled) && q.trim().length >= 3;
  const shownResults = searchActive ? results : null;

  useEffect(() => {
    if (!searchActive) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${API_URL}/api/public/widget/${encodeURIComponent(apiKey)}/search?q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
        setResults(r.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, searchActive, apiKey]);

  const replyTime = cfg.aiEnabled ? "Instant answers, any time" : cfg.teamOnline ? "Typically replies in a few minutes" : "We'll reply as soon as we're back";
  const status = cfg.teamOnline ? "Team online" : cfg.aiEnabled ? `${cfg.aiName} is available` : "Away right now";
  const live = cfg.teamOnline || cfg.aiEnabled;

  return (
    <div className="zc-scroll min-h-0 flex-1 overflow-y-auto bg-white">
      {/* Brand header */}
      <header className="zc-brand relative px-6 pb-14 pt-5">
        <div className="flex items-center justify-between">
          <BrandMark cfg={cfg} />
          {onClose ? (
            <IconButton onClick={onClose} label="Close messenger" onBrandSurface>
              <X className="size-5" />
            </IconButton>
          ) : null}
        </div>

        <h1 className="mt-9 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] [text-wrap:balance]">
          <span style={{ color: "var(--wc-muted)" }}>Hi there.</span>
          <br />
          How can we help?
        </h1>

        <div className="mt-5 flex items-center gap-3">
          {cfg.team.length > 0 ? (
            <div className="flex -space-x-2">
              {cfg.team.slice(0, 4).map((m, i) => (
                <Avatar key={i} name={m.name} image={m.image} size={28} ring="var(--wc)" />
              ))}
            </div>
          ) : null}
          <span
            className="inline-flex h-7 items-center gap-2 rounded-full px-3 text-[12px] font-semibold"
            style={{ background: "color-mix(in oklab, var(--wc-fg) 14%, transparent)" }}
          >
            <span className="relative flex size-2">
              {live ? <span className="absolute inset-0 animate-ping rounded-full bg-[#22c55e] opacity-60" /> : null}
              <span className={`relative size-2 rounded-full ${live ? "bg-[#22c55e]" : "bg-[#9fa5ad]"}`} />
            </span>
            {status}
          </span>
        </div>
      </header>

      {/* Sheet */}
      <div className="zc-sheet relative -mt-7 rounded-t-[26px] bg-white px-4 pb-4 pt-5">
        {/* Primary entry: a composer, not a card */}
        <button
          onClick={onNew}
          className="group flex w-full items-center gap-3 rounded-[18px] border border-[#e3e6ec] bg-white py-2 pl-4 pr-2 text-left shadow-[0_1px_2px_rgba(19,23,26,0.04),0_8px_24px_-12px_rgba(19,23,26,0.18)] transition-[border-color,box-shadow] hover:border-[var(--wc)] hover:shadow-[0_1px_2px_rgba(19,23,26,0.04),0_12px_28px_-12px_rgba(19,23,26,0.24)]"
        >
          <div className="min-w-0 flex-1 py-1">
            <div className="text-[15px] font-semibold">Send us a message</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#697077]">
              {cfg.aiEnabled ? <Sparkles className="size-3.5" style={{ color: "var(--wc-ink)" }} /> : <Clock className="size-3.5" />}
              {replyTime}
            </div>
          </div>
          <span className="flex size-10 items-center justify-center rounded-[13px] transition-transform group-hover:translate-x-0.5" style={{ background: "var(--wc)", color: "var(--wc-fg)" }}>
            <ArrowRight className="size-[18px]" strokeWidth={2.2} />
          </span>
        </button>

        {recent ? (
          <section className="mt-6">
            <h2 className="px-1 text-[13px] font-semibold text-[#50565b]">Continue the conversation</h2>
            <button onClick={() => onOpen(recent.id)} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-[#f6f7f9]">
              <Avatar ai={!recent.lastMessage || recent.lastMessage.role === "AI"} name={recent.assignee?.name} image={recent.assignee?.image} size={40} />
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[14px] ${unread[recent.id] ? "font-semibold" : "text-[#242a2e]"}`}>{recent.lastMessage?.content ?? "New conversation"}</div>
                <div className="mt-0.5 text-[12px] text-[#697077]">
                  {recent.lastMessage?.role === "CUSTOMER" ? "You" : recent.assignee?.name ?? cfg.aiName} · {ago(recent.lastMessageAt)}
                </div>
              </div>
              {unread[recent.id] ? (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-[#e11d48] px-1.5 text-[11px] font-bold leading-5 text-white">{unread[recent.id]}</span>
              ) : (
                <ChevronRight className="size-4 text-[#9fa5ad]" />
              )}
            </button>
          </section>
        ) : null}

        {cfg.helpEnabled ? (
          <section className="mt-6">
            <h2 className="px-1 text-[13px] font-semibold text-[#50565b]">Find an answer</h2>
            <label className="mt-2 flex h-11 items-center gap-2.5 rounded-xl bg-[#f2f4f8] px-3.5 transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_1.5px_var(--wc)]">
              <Search className="size-4 shrink-0 text-[#697077]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search our help articles"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#697077] focus-visible:outline-none"
                aria-label="Search help articles"
              />
              {searching ? <span className="size-4 animate-spin rounded-full border-2 border-[#d5d9e0] border-t-[var(--wc)]" aria-label="Searching" /> : null}
            </label>
            {shownResults ? (
              <ul className="mt-1.5 divide-y divide-[#eef0f4]">
                {shownResults.length === 0 ? (
                  <li className="px-1 py-3.5 text-[13px] text-[#697077]">
                    No articles match “{q.trim()}”.{" "}
                    <button onClick={onNew} className="font-semibold underline decoration-[1.5px] underline-offset-[3px]" style={{ color: "#13171a", textDecorationColor: "var(--wc)" }}>
                      Ask us instead
                    </button>
                  </li>
                ) : null}
                {shownResults.map((r, i) => (
                  <li key={i}>
                    <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full rounded-xl px-1 py-3 text-left" aria-expanded={expanded === i}>
                      <div className="flex items-center gap-2.5 text-[14px] font-semibold capitalize">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--wc-wash)", color: "var(--wc-ink)" }}>
                          <FileText className="size-3.5" />
                        </span>
                        <span className="flex-1 truncate">{r.title}</span>
                        <ChevronRight className={`size-4 text-[#9fa5ad] transition-transform ${expanded === i ? "rotate-90" : ""}`} />
                      </div>
                      <p className={`mt-1.5 pl-[38px] text-[13px] leading-[1.5] text-[#50565b] ${expanded === i ? "" : "line-clamp-2"}`}>{r.snippet}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <PoweredBy className="mt-8" />
      </div>
    </div>
  );
}

/* ───────────────────────── Messages list ───────────────────────── */

function MessagesView({
  cfg,
  conversations,
  unread,
  onClose,
  onNew,
  onOpen,
}: {
  cfg: WidgetConfig;
  conversations: ConvSummary[];
  unread: Record<string, number>;
  onClose?: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="zc-brand flex h-16 shrink-0 items-center gap-3 px-5">
        <h1 className="flex-1 font-display text-[18px] font-semibold tracking-[-0.01em]">Messages</h1>
        {onClose ? (
          <IconButton onClick={onClose} label="Close messenger" onBrandSurface>
            <X className="size-5" />
          </IconButton>
        ) : null}
      </header>
      <div className="zc-scroll min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl" style={{ background: "var(--wc-wash)", color: "var(--wc-ink)" }}>
              <MessageSquare className="size-6" />
            </span>
            <div className="mt-4 text-[15px] font-semibold">No conversations yet</div>
            <div className="mt-1 text-[13px] leading-[1.5] text-[#697077]">When you message {cfg.workspaceName}, your conversations will show up here.</div>
          </div>
        ) : (
          <ul className="px-2 py-2">
            {conversations.map((c) => {
              const last = c.lastMessage;
              const fromTeam = last && last.role !== "CUSTOMER";
              const who = last?.role === "AGENT" ? last.authorName ?? "Support" : cfg.aiName;
              const resolved = c.status === "RESOLVED";
              return (
                <li key={c.id}>
                  <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[#f6f7f9]">
                    <Avatar ai={!last || last.role === "AI" || (last.role === "CUSTOMER" && c.aiActive)} name={c.assignee?.name ?? last?.authorName} image={c.assignee?.image ?? last?.authorImage} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[14px] ${unread[c.id] ? "font-semibold" : "font-medium text-[#242a2e]"}`}>{who}</span>
                        <span className="shrink-0 text-[11.5px] tabular-nums text-[#868d95]">{ago(c.lastMessageAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${unread[c.id] ? "text-[#13171a]" : "text-[#697077]"}`}>
                          {last ? (fromTeam ? last.content : `You: ${last.content}`) : "New conversation"}
                        </span>
                        {unread[c.id] ? (
                          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#e11d48] px-1.5 text-[11px] font-bold leading-5 text-white">{unread[c.id]}</span>
                        ) : resolved ? (
                          <span className="shrink-0 rounded-full bg-[#f2f4f8] px-2 py-0.5 text-[11px] font-semibold text-[#50565b]">Resolved</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex justify-center px-4 pb-3 pt-2">
        <button
          onClick={onNew}
          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold shadow-[0_8px_22px_-8px_rgba(19,23,26,0.4)] transition-transform hover:-translate-y-px active:scale-[0.97]"
          style={{ background: "var(--wc)", color: "var(--wc-fg)" }}
        >
          New conversation <ArrowRight className="size-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Conversation ───────────────────────── */

function ChatView({
  cfg,
  socket,
  conversationId,
  summary,
  messages,
  typing,
  identity,
  setIdentity,
  onBack,
  onClose,
  onCreated,
  appendLocal,
  replaceLocal,
}: {
  cfg: WidgetConfig;
  socket: Socket | null;
  conversationId: string | null;
  summary: ConvSummary | null;
  messages: WMessage[];
  typing: string | null;
  identity: { name: string | null; email: string | null } | null;
  setIdentity: (v: { name: string | null; email: string | null }) => void;
  onBack: () => void;
  onClose?: () => void;
  onCreated: (id: string, first: WMessage) => void;
  appendLocal: (id: string, m: WMessage) => void;
  replaceLocal: (id: string, tempId: string, m: WMessage) => void;
}) {
  const [text, setText] = useState("");
  const [pendingFirst, setPendingFirst] = useState<WMessage | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDismissed, setEmailDismissed] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => {
    const list = messages.filter((m) => m.role !== "SYSTEM");
    return pendingFirst && !conversationId ? [pendingFirst] : list;
  }, [messages, pendingFirst, conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visible.length, typing]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-grow the composer.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  // Who is on the other side of this conversation.
  const lastAgent = [...messages].reverse().find((m) => m.role === "AGENT");
  const humanName = summary?.assignee?.name ?? lastAgent?.authorName;
  const humanImage = summary?.assignee?.image ?? lastAgent?.authorImage;
  const aiMode = summary ? summary.aiActive : cfg.aiEnabled;
  const title = aiMode || !humanName ? (cfg.aiEnabled ? cfg.aiName : cfg.workspaceName) : humanName;
  const subtitle = aiMode && cfg.aiEnabled ? `AI agent · Replies instantly` : cfg.teamOnline ? `${cfg.workspaceName} · Online` : `${cfg.workspaceName} · Replies soon`;
  const online = (aiMode && cfg.aiEnabled) || cfg.teamOnline;

  function send() {
    const content = text.trim();
    if (!content || !socket) return;
    setText("");
    setSendError(null);
    const temp: WMessage = { id: `tmp-${Date.now()}`, conversationId: conversationId ?? "new", role: "CUSTOMER", content, createdAt: new Date().toISOString() };
    if (conversationId) appendLocal(conversationId, temp);
    else setPendingFirst(temp);

    socket.emit("message:send", { content, conversationId }, (r: { ok: boolean; conversationId?: string; message?: WMessage; error?: string }) => {
      if (!r.ok || !r.message || !r.conversationId) {
        setSendError(r.error ?? "Your message didn't send. Check your connection and try again.");
        setText(content);
        if (!conversationId) setPendingFirst(null);
        return;
      }
      if (conversationId) replaceLocal(conversationId, temp.id, r.message);
      else {
        setPendingFirst(null);
        onCreated(r.conversationId, r.message);
      }
    });
    socket.emit("typing", { typing: false, conversationId });
  }

  function onType(v: string) {
    setText(v);
    if (!conversationId) return;
    socket?.emit("typing", { typing: true, conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit("typing", { typing: false, conversationId }), 1500);
  }

  function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    socket?.emit("identify", { email: emailDraft.trim(), conversationId }, (r: { ok: boolean }) => {
      if (r.ok) setIdentity({ name: identity?.name ?? null, email: emailDraft.trim() });
    });
  }

  const askEmail = cfg.askForEmail && !identity?.email && !emailDismissed && Boolean(conversationId) && visible.some((m) => m.role !== "CUSTOMER");

  // Group consecutive messages from the same sender (Messenger-style stacking).
  const groups: { role: Role; authorName?: string; authorImage?: string | null; items: WMessage[] }[] = [];
  for (const m of visible) {
    const g = groups.at(-1);
    if (g && g.role === m.role && g.authorName === m.authorName) g.items.push(m);
    else groups.push({ role: m.role, authorName: m.authorName, authorImage: m.authorImage, items: [m] });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="zc-brand flex h-[68px] shrink-0 items-center gap-2.5 px-2.5">
        <IconButton onClick={onBack} label="Back" onBrandSurface>
          <ChevronLeft className="size-5" />
        </IconButton>
        <span className="relative">
          <span className="block rounded-full" style={{ boxShadow: "0 0 0 2px color-mix(in oklab, var(--wc-fg) 30%, transparent)" }}>
            <Avatar ai={aiMode && cfg.aiEnabled} name={humanName ?? cfg.workspaceName} image={humanImage} size={38} />
          </span>
          {online ? <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#22c55e]" style={{ boxShadow: "0 0 0 2px var(--wc)" }} /> : null}
        </span>
        <div className="min-w-0 flex-1 pl-0.5">
          <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
          <div className="mt-0.5 truncate text-[12px] font-medium" style={{ color: "var(--wc-muted)" }}>
            {subtitle}
          </div>
        </div>
        {onClose ? (
          <IconButton onClick={onClose} label="Close messenger" onBrandSurface>
            <X className="size-5" />
          </IconButton>
        ) : null}
      </header>

      <div className="zc-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-6" style={{ background: "var(--wc-wash)" }}>
        {/* Intro */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex -space-x-2.5">
            {cfg.aiEnabled ? <Avatar ai size={46} ring="var(--wc-wash)" /> : null}
            {cfg.team.slice(0, 2).map((m, i) => (
              <Avatar key={i} name={m.name} image={m.image} size={46} ring="var(--wc-wash)" />
            ))}
          </div>
          <div className="mt-3 font-display text-[15px] font-semibold">{cfg.workspaceName}</div>
          <div className="mt-1 max-w-[260px] text-[12.5px] leading-[1.5] text-[#697077]">
            {cfg.aiEnabled ? `${cfg.aiName} answers right away. Our team is here whenever you need a person.` : "Ask us anything. We're here to help."}
          </div>
        </div>

        <div className="space-y-5">
          <Row role="AI" ai={cfg.aiEnabled} name={cfg.aiEnabled ? cfg.aiName : cfg.workspaceName} items={[{ id: "greet", content: cfg.greeting, createdAt: "" }]} />
          {groups.map((g, i) => (
            <Row key={i} role={g.role} ai={g.role === "AI"} name={g.role === "AI" ? cfg.aiName : g.authorName ?? "Support"} image={g.authorImage} items={g.items} />
          ))}
          {typing ? (
            <div className="zc-msg flex items-end gap-2" aria-live="polite">
              <Avatar ai={typing === cfg.aiName} name={typing} size={28} />
              <div className="rounded-[18px] rounded-bl-[6px] border border-[#e8ebf0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(19,23,26,0.04)]">
                <span className="zc-typing inline-flex gap-1 text-[#9fa5ad]" aria-label={`${typing} is typing`}>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          ) : null}

          {askEmail ? (
            <form onSubmit={saveEmail} className="zc-msg ml-9 max-w-[86%] rounded-[18px] border border-[#e8ebf0] bg-white p-4 shadow-[0_6px_20px_-12px_rgba(19,23,26,0.25)]">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md" style={{ background: "var(--wc-wash)", color: "var(--wc-ink)" }}>
                  <Mail className="size-3.5" />
                </span>
                Get replies by email
              </div>
              <div className="mt-1 text-[12.5px] leading-[1.45] text-[#697077]">If you leave, we&apos;ll send our answer to your inbox.</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="email"
                  required
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#d5d9e0] px-3 text-[13.5px] outline-none transition-shadow placeholder:text-[#868d95] focus:border-[var(--wc)] focus:shadow-[0_0_0_3px_var(--wc-soft)] focus-visible:outline-none"
                  aria-label="Your email"
                />
                <button type="submit" className="h-10 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold" style={{ background: "var(--wc)", color: "var(--wc-fg)" }}>
                  Save
                </button>
              </div>
              <button type="button" onClick={() => setEmailDismissed(true)} className="mt-2.5 text-[12px] font-medium text-[#697077] hover:text-[#13171a]">
                Not now
              </button>
            </form>
          ) : null}
          {summary?.status === "RESOLVED" ? (
            <div className="flex items-center gap-3 py-1 text-[12px] font-medium text-[#697077]">
              <span className="h-px flex-1 bg-[#e3e6ec]" />
              Resolved · reply to reopen
              <span className="h-px flex-1 bg-[#e3e6ec]" />
            </div>
          ) : null}
        </div>
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-[#eef0f4] bg-white px-3 pb-2.5 pt-3">
        {sendError ? (
          <div role="alert" className="mb-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[12.5px] font-medium text-[#be123c]">
            {sendError}
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-[20px] border border-[#d5d9e0] bg-white py-1.5 pl-4 pr-1.5 transition-[border-color,box-shadow] focus-within:border-[var(--wc)] focus-within:shadow-[0_0_0_3px_var(--wc-soft)]">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={conversationId ? "Reply…" : "Ask a question…"}
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] leading-[1.4] outline-none placeholder:text-[#868d95] focus-visible:outline-none"
            aria-label="Message"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-[14px] transition-[opacity,transform] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: "var(--wc)", color: "var(--wc-fg)" }}
            aria-label="Send message"
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.4} />
          </button>
        </div>
        <PoweredBy className="mt-2.5" />
      </div>
    </div>
  );
}

function Row({
  role,
  ai,
  name,
  image,
  items,
}: {
  role: Role;
  ai?: boolean;
  name?: string;
  image?: string | null;
  items: { id: string; content: string; createdAt: string }[];
}) {
  const mine = role === "CUSTOMER";
  const last = items.at(-1);

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-[3px]">
        {items.map((m, i) => (
          <div
            key={m.id}
            className={`zc-msg max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14px] leading-[1.45] shadow-[0_1px_2px_rgba(19,23,26,0.08)] transition-opacity ${m.id.startsWith("tmp-") ? "opacity-60" : ""}`}
            style={{
              background: "var(--wc)",
              color: "var(--wc-fg)",
              borderRadius: `18px ${i === 0 ? 18 : 6}px 6px 18px`,
            }}
          >
            {m.content}
          </div>
        ))}
        {last?.createdAt ? <div className="pr-1 pt-0.5 text-[11px] font-medium tabular-nums text-[#868d95]">{last.id.startsWith("tmp-") ? "Sending…" : clock(last.createdAt)}</div> : null}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Avatar ai={ai} name={name} image={image} size={28} />
      <div className="flex min-w-0 max-w-[82%] flex-col items-start gap-[3px]">
        {items.map((m, i) => (
          <div
            key={m.id}
            className="zc-msg whitespace-pre-wrap break-words border border-[#e8ebf0] bg-white px-3.5 py-2.5 text-[14px] leading-[1.45] text-[#13171a] shadow-[0_1px_2px_rgba(19,23,26,0.04)]"
            style={{ borderRadius: `${i === 0 ? 18 : 6}px 18px 18px 6px` }}
          >
            {m.content}
          </div>
        ))}
        <div className="flex items-center gap-1.5 pl-1 pt-0.5 text-[11px] font-medium text-[#868d95]">
          <span className="text-[#50565b]">{name}</span>
          {ai ? (
            <span className="rounded px-1 py-px text-[10px] font-semibold" style={{ background: "var(--wc-soft)", color: "#13171a" }}>
              AI
            </span>
          ) : null}
          {last?.createdAt ? <span className="tabular-nums">· {clock(last.createdAt)}</span> : null}
        </div>
      </div>
    </div>
  );
}
