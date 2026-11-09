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

  // Show the loading state again whenever the request key changes (adjusting state during render).
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    if (path) setLoading(true);
  }

  // Fetches the current key; state is only updated from promise callbacks.
  const fetchCurrent = useCallback(
    (): Promise<void> => {
      if (!path) return Promise.resolve();
      const k = path + JSON.stringify(query ?? {});
      latest.current = k;
      return api<T>(path, { query })
        .then(
          (res) => {
            if (latest.current !== k) return;
            setData(res);
            setError(null);
          },
          (e) => {
            if (latest.current === k) setError(e as Error);
          },
        )
        .finally(() => {
          if (latest.current === k) setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const reload = useCallback(
    (silent = false) => {
      if (!silent && path) setLoading(true);
      return fetchCurrent();
    },
    [fetchCurrent, path],
  );

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  return { data, setData, error, loading, reload };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
