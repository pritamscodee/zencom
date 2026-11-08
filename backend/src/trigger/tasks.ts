import { task } from "@trigger.dev/sdk";
import { ingestDocument } from "../services/ingestion";
import { sendTicketToProvider } from "../services/tickets";

export const ingestDocumentTask = task({
  id: "ingest-document",
  retry: { maxAttempts: 3, minTimeoutInMs: 2000, factor: 2 },
  queue: { concurrencyLimit: 5 },
  run: async (payload: { documentId: string }) => {
    return ingestDocument(payload.documentId);
  },
});

export const sendTicketTask = task({
  id: "send-ticket",
  retry: { maxAttempts: 3 },
  run: async (payload: { ticketId: string; provider: "SLACK" | "LINEAR"; actorId: string }) => {
    return sendTicketToProvider(payload.ticketId, payload.provider, payload.actorId);
  },
});
