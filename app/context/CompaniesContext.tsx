import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCompanies } from "../services/api";
import { CompanyRecord } from "../types/domain";

interface CompaniesContextValue {
  companies: CompanyRecord[];
  isLoading: boolean;
  error: string | null;
  /** Looks up an already-fetched company by id -- undefined if the list
   * hasn't loaded yet or no company has that id. */
  getById: (id: string) => CompanyRecord | undefined;
  refresh: () => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextValue | undefined>(undefined);

/**
 * Fetches the full company list once (GET /companies) and shares it across
 * every screen that used to import static mock data directly (Discover,
 * Watchlist, Compare, the company profile screen, utils/pipelineLookup.ts).
 * This is what actually makes "the database can grow/update without an app
 * rebuild" true in practice -- a shared cache backed by a real API call,
 * not a bundled constant.
 */
export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The mount fetch is a plain async IIFE (first statement is the await)
  // rather than routing through `refresh` below -- `refresh` sets loading
  // state synchronously up front, which is fine when a user action (e.g. a
  // future pull-to-refresh) calls it, but would be a synchronous setState
  // inside this effect's own body if called from here directly. Initial
  // state is already `isLoading: true`, so nothing needs setting before
  // the fetch resolves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getCompanies();
        if (!cancelled) setCompanies(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load companies.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCompanies();
      setCompanies(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load companies.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getById = useCallback(
    (id: string) => companies.find((company) => company.id === id),
    [companies],
  );

  const value = useMemo(
    () => ({ companies, isLoading, error, getById, refresh }),
    [companies, isLoading, error, getById, refresh],
  );

  return <CompaniesContext.Provider value={value}>{children}</CompaniesContext.Provider>;
}

export function useCompanies(): CompaniesContextValue {
  const context = useContext(CompaniesContext);
  if (!context) throw new Error("useCompanies must be used within a CompaniesProvider");
  return context;
}
