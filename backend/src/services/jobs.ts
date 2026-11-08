import { tasks } from "@trigger.dev/sdk";
import { features } from "../lib/env";
import type { ingestDocumentTask, sendTicketTask } from "../trigger/tasks";

/**
 * Background jobs. With TRIGGER_SECRET_KEY set they run on Trigger.dev
 * (retries, observability). Without it they run in-process so local dev works.
 */
export const jobs = {
  async ingestDocument(documentId: string) {
    if (features.trigger()) {
      await tasks.trigger<typeof ingestDocumentTask>("ingest-document", { documentId });
      return;
    }
    const { ingestDocument } = await import("./ingestion");
    ingestDocument(documentId).catch((e) => console.error("[ingest]", e));
  },

  async sendTicket(payload: { ticketId: string; provider: "SLACK" | "LINEAR"; actorId: string }) {
    if (features.trigger()) {
      await tasks.trigger<typeof sendTicketTask>("send-ticket", payload);
      return { queued: true };
    }
    const { sendTicketToProvider } = await import("./tickets");
    return sendTicketToProvider(payload.ticketId, payload.provider, payload.actorId);
  },
};
