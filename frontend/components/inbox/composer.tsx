"use client";

import { useRef, useState } from "react";
import { Button, toast } from "@heroui/react";
import { Send, StickyNote } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useWorkspace } from "@/components/app/workspace-provider";

export function Composer({ conversationId, aiActive, onSent }: { conversationId: string; aiActive: boolean; onSent?: () => void }) {
  const { socket } = useWorkspace();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function emitTyping(v: string) {
    setText(v);
    if (mode !== "reply" || !socket) return;
    socket.emit("typing", { conversationId, typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("typing", { conversationId, typing: false }), 1500);
  }

  async function send() {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      await api(`/api/conversations/${conversationId}/messages`, { method: "POST", body: { content, internal: mode === "note" } });
      setText("");
      socket?.emit("typing", { conversationId, typing: false });
      onSent?.();
    } catch (e) {
      toast.danger("Message not sent", { description: errorMessage(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-separator p-2.5 sm:p-4">
      <div className={`rounded-xl border bg-surface transition-colors ${mode === "note" ? "border-warning/50 bg-warning/5" : "border-separator focus-within:border-accent"}`}>
        <div className="flex items-center gap-1 px-2 pt-2">
          {(["reply", "note"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                mode === m ? (m === "note" ? "bg-warning/15 text-warning" : "bg-default text-foreground") : "text-muted hover:text-foreground"
              }`}
            >
              {m === "reply" ? <Send className="size-3.5" /> : <StickyNote className="size-3.5" />}
              {m === "reply" ? "Reply" : "Internal note"}
            </button>
          ))}
          {mode === "reply" && aiActive ? <span className="ml-auto pr-2 text-[11px] text-muted">Replying takes over from AI</span> : null}
        </div>
        <textarea
          value={text}
          onChange={(e) => emitTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder={mode === "reply" ? "Write a reply…  (Enter to send, Shift + Enter for a new line)" : "Add a note only your team can see…"}
          className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted"
        />
        <div className="flex justify-end px-2 pb-2">
          <Button size="sm" onPress={send} isPending={sending} isDisabled={!text.trim()} variant={mode === "note" ? "secondary" : "primary"}>
            {mode === "reply" ? "Send" : "Add note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
