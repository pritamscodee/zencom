"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

/** Minimal data hook: fetch on mount / when deps change, expose reload + local mutate. */
export function useFetch<T>(path: string | null, query?: Record<string, string | number | undefined | null>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const key = path ? path + JSON.stringify(query ?? {}) : null;
  const latest = useRef(key);

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent) setLoading(true);
      const k = path + JSON.stringify(query ?? {});
      latest.current = k;
      try {
        const res = await api<T>(path, { query });
        if (latest.current === k) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (latest.current === k) setError(e as Error);
      } finally {
        if (latest.current === k) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
