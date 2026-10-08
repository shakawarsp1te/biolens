import { useEffect, useState } from "react";
import { ApiError } from "../services/api";

export type Resource<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; data: T };

// Session-wide cache of in-flight and settled requests, keyed by what was
// asked for (e.g. "valuation:ARVN"). Switching a company dashboard's tabs
// remounts panels that need the same data; this keeps that instant and
// avoids re-hitting SEC/market endpoints the page already called. Failed
// requests are dropped so a later mount can retry.
const cache = new Map<string, Promise<unknown>>();

// The API answers 503/429 when an upstream source (ClinicalTrials.gov,
// SEC) is rate-limiting it -- a "try again shortly", not a real failure.
const RETRY_DELAYS_MS = [8_000, 20_000];

function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 503 || err.status === 429);
}

async function withRetry<T>(fetcher: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetcher();
    } catch (err) {
      if (!isRetryable(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = withRetry(fetcher);
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

/** Fetches once per key per session and shares the result with every
 * component that asks for the same key. Pass `null` to skip (e.g. a
 * company with no ticker has no quote to fetch). */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> | null {
  const [state, setState] = useState<{ key: string | null; resource: Resource<T> }>({
    key,
    resource: { status: "loading" },
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load(key, fetcher)
      .then((data) => {
        if (!cancelled) setState({ key, resource: { status: "loaded", data } });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            key,
            resource: {
              status: "error",
              message: err instanceof Error ? err.message : "Couldn't load this data.",
            },
          });
      });
    return () => {
      cancelled = true;
    };
    // `fetcher` is expected to be an inline closure over the same inputs
    // as `key`; the key alone decides when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === null) return null;
  // A key change renders "loading" until the new request settles, instead
  // of briefly showing the previous key's data.
  return state.key === key ? state.resource : { status: "loading" };
}

/** useResource for a list of keys at once -- e.g. every company's
 * valuation for the screener. Shares the same cache, so a company opened
 * from the screener already has its figures. Returns key -> Resource;
 * keys not yet settled are "loading". */
export function useResourceMap<T>(
  keys: string[],
  fetcher: (key: string) => Promise<T>,
): Record<string, Resource<T>> {
  const [settled, setSettled] = useState<Record<string, Resource<T>>>({});
  const signature = keys.join("|");

  useEffect(() => {
    let cancelled = false;
    for (const key of keys) {
      load(key, () => fetcher(key))
        .then((data) => {
          if (!cancelled) setSettled((prev) => ({ ...prev, [key]: { status: "loaded", data } }));
        })
        .catch((err: unknown) => {
          if (!cancelled)
            setSettled((prev) => ({
              ...prev,
              [key]: {
                status: "error",
                message: err instanceof Error ? err.message : "Couldn't load this data.",
              },
            }));
        });
    }
    return () => {
      cancelled = true;
    };
    // `signature` stands in for `keys`; `fetcher` is an inline closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const result: Record<string, Resource<T>> = {};
  for (const key of keys) result[key] = settled[key] ?? { status: "loading" };
  return result;
}
