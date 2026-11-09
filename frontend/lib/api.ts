import { httpBase } from "./config";

const WS_KEY = "zencom.workspaceId";

export const workspaceStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(WS_KEY)),
  set: (id: string) => localStorage.setItem(WS_KEY, id),
  clear: () => localStorage.removeItem(WS_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; query?: Record<string, string | number | undefined | null> };

/** Credentialed fetch to the Zencom API, scoped to the active workspace. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const url = new URL(httpBase() + path);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && url.searchParams.set(k, String(v)));
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const ws = workspaceStore.get();
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      ...(isForm || opts.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(ws ? { "x-workspace-id": ws } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? res.statusText);
  return data as T;
}
