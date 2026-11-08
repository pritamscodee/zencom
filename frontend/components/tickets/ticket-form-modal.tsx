"use client";

import { useState } from "react";
import { Button, Modal, toast } from "@heroui/react";
import { AreaField, Field } from "@/components/ui/field";
import { Picker } from "@/components/ui/pickers";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Ticket } from "@/lib/types";

const CATEGORIES = ["bug", "billing", "account", "feature_request", "technical", "shipping", "general"];

export function TicketFormModal({
  isOpen,
  onOpenChange,
  conversationId,
  defaultTitle = "",
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId?: string | null;
  defaultTitle?: string;
  onCreated?: (t: Ticket) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const t = await api<Ticket>("/api/tickets", {
        method: "POST",
        body: { title, description, priority, category, conversationId: conversationId ?? null },
      });
      toast.success(`Ticket #${t.number} saved`);
      onCreated?.(t);
      onOpenChange(false);
      setTitle("");
      setDescription("");
    } catch (e) {
      toast.danger("Could not save ticket", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>New ticket</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <Field label="Title" value={title} onChange={setTitle} isRequired placeholder="Payment fails at checkout" />
            <AreaField label="Description" value={description} onChange={setDescription} rows={5} placeholder="What happened, steps to reproduce, impact…" />
            <div className="grid grid-cols-2 gap-3">
              <Picker
                label="Priority"
                value={priority}
                onChange={(v) => setPriority(v ?? "MEDIUM")}
                options={["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => ({ id: p, label: p[0] + p.slice(1).toLowerCase() }))}
              />
              <Picker label="Category" value={category} onChange={(v) => setCategory(v ?? "general")} options={CATEGORIES.map((c) => ({ id: c, label: c.replace("_", " ") }))} />
            </div>
            {conversationId ? <p className="text-xs text-muted">If this conversation already has an open ticket, it will be updated instead of duplicated.</p> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">
              Cancel
            </Button>
            <Button onPress={save} isPending={saving} isDisabled={!title.trim() || !description.trim()}>
              Save ticket
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
