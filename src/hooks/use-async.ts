/**
 * hooks/use-async.ts
 *
 * The universal hook for "fetch data, show loading, show error" — the pattern
 * every single page in this app follows. Instead of writing the same
 * useState/useEffect/loading/error boilerplate 40 times, use this once.
 *
 * HOW TO USE:
 *
 *   // Basic usage — auto-fetch when component mounts
 *   const { data, loading, error, refetch } = useAsync(
 *     () => patientsApi.list({ limit: 25 }),
 *   );
 *
 *   // With dependencies — re-fetch when search changes
 *   const { data, loading } = useAsync(
 *     () => patientsApi.list({ search }),
 *     [search],   // re-runs whenever search changes
 *   );
 *
 *   // Manual fetch — don't auto-run on mount
 *   const { data, loading, run } = useAsync(
 *     () => visitsApi.get(visitId),
 *     [],
 *     { immediate: false },
 *   );
 *   // Then call run() when you want it
 *
 * WHAT YOU GET BACK:
 *   data     — the returned value, or null while loading
 *   loading  — true while the request is in flight
 *   error    — the error message string if it failed, or null
 *   refetch  — call this to re-run the same request (e.g. after a mutation)
 */

"use client";

import { useState, useEffect, useCallback, useRef, DependencyList } from "react";

interface UseAsyncOptions {
  /** If false, the fetch does NOT run on mount. Call refetch() manually. Default: true */
  immediate?: boolean;
}

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the async function. Call this after you've done a mutation (add/edit/delete). */
  refetch: () => void;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList = [],
  options: UseAsyncOptions = {},
): UseAsyncResult<T> {
  const { immediate = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable reference to asyncFn so we don't re-run on every render
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  // Track whether the component is still mounted — avoids "setState on unmounted component"
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (mountedRef.current) setData(result);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Run automatically when component mounts (and when deps change)
  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, run, ...deps]);

  return { data, loading, error, refetch: run };
}
