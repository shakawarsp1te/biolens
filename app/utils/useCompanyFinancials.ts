import { useEffect, useState } from "react";
import {
  FinancialHealth,
  getCompanyCatalysts,
  getFinancialHealth,
  getValuation,
  Valuation,
} from "../services/api";
import { CatalystEvent } from "../types/domain";

export interface CompanyFinancials {
  health: FinancialHealth | null;
  valuation: Valuation | null;
  nextCatalyst: CatalystEvent | null;
  loading: boolean;
}

type Loaded = Omit<CompanyFinancials, "loading"> & { key: string };

/**
 * Cash, valuation and next catalyst for one company, fetched together for
 * the comparison screen. Each source fails independently to null — a
 * private company simply has no market data, which is a normal state.
 * Results are stored with the company they belong to, so switching
 * companies reads as loading until the new fetch lands, with no
 * synchronous state reset inside the effect.
 */
export function useCompanyFinancials(
  companyId: string | undefined,
  ticker: string | undefined,
): CompanyFinancials {
  const key = `${companyId ?? ""}|${ticker ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const orNull = <T>(p: Promise<T>) => p.catch(() => null);
    Promise.all([
      ticker ? orNull(getFinancialHealth(ticker)) : Promise.resolve(null),
      ticker ? orNull(getValuation(ticker)) : Promise.resolve(null),
      orNull(getCompanyCatalysts(companyId)),
    ]).then(([health, valuation, catalysts]) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = (catalysts ?? [])
        .filter((c) => c.expectedDate >= today)
        .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
      setLoaded({ key, health, valuation, nextCatalyst: upcoming[0] ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, ticker, key]);

  if (!companyId) return { health: null, valuation: null, nextCatalyst: null, loading: false };
  if (!loaded || loaded.key !== key) {
    return { health: null, valuation: null, nextCatalyst: null, loading: true };
  }
  return {
    health: loaded.health,
    valuation: loaded.valuation,
    nextCatalyst: loaded.nextCatalyst,
    loading: false,
  };
}
