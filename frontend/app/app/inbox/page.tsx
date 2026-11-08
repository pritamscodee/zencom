import { MessagesSquare } from "lucide-react";

export default function InboxIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-muted">
      <MessagesSquare className="mb-3 size-8" />
      <p className="text-sm">Select a conversation to view it.</p>
    </div>
  );
}
