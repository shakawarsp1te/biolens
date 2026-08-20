import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as watchlistService from "../services/watchlist";
import { WatchlistEntityType, WatchlistEntry } from "../services/watchlist";

interface WatchlistContextValue {
  entries: WatchlistEntry[];
  loading: boolean;
  isWatched: (entityType: WatchlistEntityType, entityId: string) => boolean;
  toggle: (entityType: WatchlistEntityType, entityId: string) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/** Single source of truth for watchlist state across screens — a bookmark
 * toggled on Discover shows up on Watchlist immediately without either
 * screen needing to know about the other or re-fetch on focus. */
export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    watchlistService.getWatchlist().then((list) => {
      if (!cancelled) {
        setEntries(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isWatched = useCallback(
    (entityType: WatchlistEntityType, entityId: string) =>
      entries.some((entry) => entry.entityType === entityType && entry.entityId === entityId),
    [entries],
  );

  const toggle = useCallback(
    async (entityType: WatchlistEntityType, entityId: string) => {
      const currentlyWatched = entries.some(
        (entry) => entry.entityType === entityType && entry.entityId === entityId,
      );
      const next = currentlyWatched
        ? await watchlistService.removeFromWatchlist(entityType, entityId)
        : await watchlistService.addToWatchlist(entityType, entityId);
      setEntries(next);
    },
    [entries],
  );

  return (
    <WatchlistContext.Provider value={{ entries, loading, isWatched, toggle }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within a WatchlistProvider");
  return ctx;
}
