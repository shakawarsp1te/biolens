import { useEffect, useState } from "react";

export type Resource<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "loaded"; data: T };

// Session-wide cache of in-flight and settled requests, keyed by what was
// asked for (e.g. "valuation:ARVN"). Switching a company dashboard's tabs
// remounts panels that need the same data; this keeps that instant and
// avoids re-hitting SEC/market endpoints the page already called. Failed
// requests are dropped so a later mount can retry.
const cache = new Map<string, Promise<unknown>>();

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = fetcher();
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
