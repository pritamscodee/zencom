/**
 * Zencom identity.
 * Mechanism — "the handoff": a Z drawn as a conversation. Top bar = the customer's message,
 * diagonal = the handoff (AI → human), bottom bar ends in a speech-bubble tail = the reply that resolves it.
 * Drawn on a 100-unit grid from filled primitives (no strokes), so it holds at 16 px.
 */

const BLUE = "#0052F2"; // brand-1 (DESIGN.md primary)
const BLUE_LIGHT = "#4083FF"; // brand-1 on dark / message bar
const INK = "#13171A";

type MarkProps = { className?: string; tone?: "brand" | "white" | "ink" | "current"; title?: string };

/** The symbol alone (transparent background). */
export function LogoMark({ className = "size-7", tone = "brand", title }: MarkProps) {
  const msg = tone === "brand" ? BLUE_LIGHT : tone === "white" ? "rgba(255,255,255,0.72)" : tone === "ink" ? INK : "currentColor";
  const main = tone === "brand" ? BLUE : tone === "white" ? "#fff" : tone === "ink" ? INK : "currentColor";
  return (
    <svg viewBox="6 10 88 88" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {/* message (top bar) */}
      <rect x="14" y="16" width="72" height="18" rx="9" fill={msg} />
      {/* handoff (diagonal) + reply (bottom bar with bubble tail) */}
      <path
        fill={main}
        d="M52 34h25L48 66H23Z M23 66h54a9 9 0 0 1 0 18H44L26 94V83.4A9 9 0 0 1 23 66Z"
      />
    </svg>
  );
}

/** App icon / favicon tile: white mark on the brand blue. */
export function LogoTile({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="24" fill={BLUE} />
      <g transform="translate(18 16) scale(0.64)">
        <rect x="14" y="16" width="72" height="18" rx="9" fill="#fff" fillOpacity="0.72" />
        <path fill="#fff" d="M52 34h25L48 66H23Z M23 66h54a9 9 0 0 1 0 18H44L26 94V83.4A9 9 0 0 1 23 66Z" />
      </g>
    </svg>
  );
}

/** Lockup: symbol + wordmark (Poppins SemiBold, lowercase, slight negative tracking). */
export function Logo({
  className = "",
  markClassName = "size-7",
  tone = "brand",
  wordClassName = "",
}: {
  className?: string;
  markClassName?: string;
  tone?: "brand" | "white" | "ink";
  wordClassName?: string;
}) {
  const word = tone === "white" ? "text-white" : tone === "ink" ? "text-[#13171a]" : "text-[#13171a]";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Zencom">
      <LogoMark className={markClassName} tone={tone} />
      <span className={`font-display font-semibold lowercase tracking-[-0.03em] ${word} ${wordClassName}`}>zencom</span>
    </span>
  );
}
