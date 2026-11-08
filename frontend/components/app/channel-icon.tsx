import { Globe } from "lucide-react";
import type { Channel } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChannelIcon({ channel, className = "size-3.5" }: { channel: Channel; className?: string }) {
  return <Globe className={`${className} text-accent`} aria-label="Website chat" />;
}

export const CHANNEL_LABEL: Record<Channel, string> = { WEB: "Website chat" };
