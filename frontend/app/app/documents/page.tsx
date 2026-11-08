"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Chip, Dropdown, Label, Spinner, toast } from "@heroui/react";
import { BookOpen, Download, FileText, MoreHorizontal, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { EmptyState, PageHeader, SetupNotice } from "@/components/app/page-header";
import { useRealtime, useWorkspace } from "@/components/app/workspace-provider";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useFetch } from "@/lib/hooks";
import { errorMessage, fileSize, timeAgo } from "@/lib/format";
import type { DocumentItem } from "@/lib/types";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm";
const STATUS: Record<DocumentItem["status"], { label: string; color: "default" | "warning" | "success" | "danger" }> = {
  UPLOADED: { label: "Queued", color: "default" },
  PROCESSING: { label: "Indexing", color: "warning" },
  READY: { label: "Ready", color: "success" },
  FAILED: { label: "Failed", color: "danger" },
};

type Res = { items: DocumentItem[]; ready: { openai: boolean; pinecone: boolean; r2: boolean; trigger: boolean } };

export default function DocumentsPage() {
  const { isAdmin } = useWorkspace();
  const { data, setData, loading, reload } = useFetch<Res>("/api/documents");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ documentName: string; text: string; score: number }[] | null>(null);
  const [searching, setSearching] = useState(false);

  useRealtime<DocumentItem>(
    "document:updated",
    useCallback((d) => setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === d.id ? { ...x, ...d } : x)) } : prev)), [setData]),
  );

  // Trigger.dev workers can't push socket events — poll while anything is in flight.
  const inFlight = data?.items.some((d) => d.status === "UPLOADED" || d.status === "PROCESSING");
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => reload(true), 4000);
    return () => clearInterval(t);
  }, [inFlight, reload]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    const form = new FormData();
    list.forEach((f) => form.append("files", f));
    setUploading(true);
    try {
      await api("/api/documents", { method: "POST", body: form });
      toast.success(`${list.length} document${list.length > 1 ? "s" : ""} uploaded`, { description: "Indexing has started." });
      reload(true);
    } catch (e) {
      toast.danger("Upload failed", { description: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  }

  async function replace(file: File) {
    const id = replaceTarget.current;
    if (!id) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await api(`/api/documents/${id}`, { method: "PUT", body: form });
      toast.success("New version uploaded — re-indexing");
      reload(true);
    } catch (e) {
      toast.danger("Replace failed", { description: errorMessage(e) });
    }
  }

  async function action(doc: DocumentItem, key: string) {
    try {
      if (key === "reindex") {
        await api(`/api/documents/${doc.id}/reindex`, { method: "POST" });
        toast("Re-indexing started");
      } else if (key === "replace") {
        replaceTarget.current = doc.id;
        replaceInput.current?.click();
        return;
      } else if (key === "download") {
        window.open(`${API_URL}/api/documents/${doc.id}/download`, "_blank");
        return;
      } else if (key === "delete") {
        if (!confirm(`Delete "${doc.name}"? It will be removed from the AI's knowledge.`)) return;
        await api(`/api/documents/${doc.id}`, { method: "DELETE" });
        toast.success("Document deleted");
      }
      reload(true);
    } catch (e) {
      toast.danger("Action failed", { description: errorMessage(e) });
    }
  }

  async function testSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api<{ results: typeof results }>("/api/documents/search", { method: "POST", body: { query } });
      setResults(r.results);
    } catch (e) {
      toast.danger("Search failed", { description: errorMessage(e) });
    } finally {
      setSearching(false);
    }
  }

  const missing = data && (!data.ready.openai || !data.ready.pinecone);

  return (
    <div className="zc-scroll h-full overflow-y-auto">
      <PageHeader
        title="Document Hub"
        description="Upload help articles, policies and product docs. Zencom splits them into chunks, embeds them, and the AI agent searches them to answer customers. Each workspace's knowledge is kept separate."
        actions={
          isAdmin ? (
            <Button onPress={() => fileInput.current?.click()} isPending={uploading}>
              <Upload className="size-4" /> Upload
            </Button>
          ) : null
        }
      />
      {missing ? (
        <SetupNotice>
          Indexing needs <b>OPENAI_API_KEY</b> and <b>PINECONE_API_KEY</b> in <code>backend/.env</code>. Uploads are stored{" "}
          {data.ready.r2 ? "in Cloudflare R2" : "locally (R2 not configured)"} and will fail indexing until those keys are set.
        </SetupNotice>
      ) : null}

      <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) replace(f);
          e.target.value = "";
        }}
      />

      <div className="grid gap-8 px-4 sm:px-6 lg:px-8 py-6 xl:grid-cols-[1fr_360px]">
        <div>
          {isAdmin ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                upload(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              className={`mb-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                dragging ? "border-accent bg-accent/5" : "border-separator hover:border-accent/50"
              }`}
            >
              <Upload className="mb-2 size-5 text-muted" />
              <div className="text-sm font-medium">Drop files here or click to upload</div>
              <div className="mt-1 text-xs text-muted">PDF, DOCX, TXT, Markdown, CSV, JSON, HTML · up to 25 MB each</div>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : data?.items.length === 0 ? (
            <EmptyState icon={<BookOpen className="size-5" />} title="No documents yet" description="Upload your FAQ, return policy or product guide so the AI can answer from your content." />
          ) : (
            <ul className="divide-y divide-separator overflow-hidden rounded-xl border border-separator">
              {data?.items.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-default">
                    <FileText className="size-4 text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted">
                      {fileSize(d.size)} · v{d.version} · {d.chunkCount ? `${d.chunkCount} chunks · ` : ""}
                      {d.uploadedBy?.name ? `${d.uploadedBy.name} · ` : ""}
                      {timeAgo(d.updatedAt)}
                    </div>
                    {d.status === "FAILED" && d.error ? <div className="mt-0.5 truncate text-xs text-danger">{d.error}</div> : null}
                  </div>
                  <Chip size="sm" variant="soft" color={STATUS[d.status].color}>
                    {d.status === "PROCESSING" ? <Spinner size="sm" color="current" /> : null}
                    {STATUS[d.status].label}
                  </Chip>
                  {isAdmin ? (
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="ghost" aria-label="Document actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                      <Dropdown.Popover>
                        <Dropdown.Menu onAction={(k) => action(d, String(k))}>
                          <Dropdown.Item id="replace" textValue="Upload new version">
                            <Upload className="size-4" />
                            <Label>Upload new version</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="reindex" textValue="Re-index">
                            <RefreshCw className="size-4" />
                            <Label>Re-index</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="download" textValue="Download">
                            <Download className="size-4" />
                            <Label>Download original</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                            <Trash2 className="size-4" />
                            <Label>Delete</Label>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="rounded-xl border border-separator p-5">
            <h3 className="font-semibold">Test your knowledge base</h3>
            <p className="mt-1 text-xs text-muted">See which passages the AI would retrieve for a customer question.</p>
            <form onSubmit={testSearch} className="mt-4 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="How do I return an item?"
                className="h-9 min-w-0 flex-1 rounded-lg border border-field-border bg-field px-3 text-sm outline-none focus:border-accent"
              />
              <Button type="submit" isIconOnly aria-label="Search" isPending={searching}>
                <Search className="size-4" />
              </Button>
            </form>
            {results ? (
              <div className="mt-4 space-y-3">
                {results.length === 0 ? <p className="text-xs text-muted">No matching passages.</p> : null}
                {results.map((r, i) => (
                  <div key={i} className="rounded-lg bg-default/50 p-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                      <span className="truncate font-medium">{r.documentName}</span>
                      <span>{Math.round(r.score * 100)}% match</span>
                    </div>
                    <p className="line-clamp-5 text-xs leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
