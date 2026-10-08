import {
  ChartRange,
  getCompanyCatalysts,
  getCompanyCompetitors,
  getCompanySignals,
  getFinancialHealth,
  getFinancialHistory,
  getRecentSignals,
  getTrackRecord,
  getStockHistory,
  getStockQuote,
  getValuation,
} from "../services/api";
import { useResource, useResourceMap } from "./useResource";

// One hook per dataset a company dashboard reads, all cached per session by
// useResource -- the header, the sidebar and every tab can ask for the same
// data without triggering a second request. `null` (no ticker) skips.

export const useQuote = (ticker?: string) =>
  useResource(ticker ? `quote:${ticker}` : null, () => getStockQuote(ticker as string));

export const usePriceHistory = (ticker: string | undefined, range: ChartRange) =>
  useResource(ticker ? `history:${ticker}:${range}` : null, () =>
    getStockHistory(ticker as string, range),
  );

export const useValuation = (ticker?: string) =>
  useResource(ticker ? `valuation:${ticker}` : null, () => getValuation(ticker as string));

export const useFinancialHealth = (ticker?: string) =>
  useResource(ticker ? `health:${ticker}` : null, () => getFinancialHealth(ticker as string));

export const useFinancialHistory = (ticker?: string) =>
  useResource(ticker ? `financials:${ticker}` : null, () => getFinancialHistory(ticker as string));

export const useCatalysts = (companyId: string) =>
  useResource(`catalysts:${companyId}`, () => getCompanyCatalysts(companyId));

export const useCompetitors = (companyId: string) =>
  useResource(`competitors:${companyId}`, () => getCompanyCompetitors(companyId));

export const useSignals = (companyId: string) =>
  useResource(`signals:${companyId}`, () => getCompanySignals(companyId));

// --- Many companies at once (screener, financial analysis, calendar) ---

const tickerKeys = (prefix: string, tickers: string[]) => tickers.map((t) => `${prefix}:${t}`);
const fromKey = (key: string) => key.slice(key.indexOf(":") + 1);

/** ticker -> valuation resource, for every ticker given. */
export function useValuations(tickers: string[]) {
  const map = useResourceMap(tickerKeys("valuation", tickers), (key) => getValuation(fromKey(key)));
  return (ticker: string) => map[`valuation:${ticker}`];
}

/** ticker -> cash & runway resource, for every ticker given. */
export function useFinancialHealths(tickers: string[]) {
  const map = useResourceMap(tickerKeys("health", tickers), (key) =>
    getFinancialHealth(fromKey(key)),
  );
  return (ticker: string) => map[`health:${ticker}`];
}

/** companyId -> catalysts resource, for every company given. */
export function useAllCatalysts(companyIds: string[]) {
  const map = useResourceMap(tickerKeys("catalysts", companyIds), (key) =>
    getCompanyCatalysts(fromKey(key)),
  );
  return (companyId: string) => map[`catalysts:${companyId}`];
}

// --- Cross-company research feeds ---

export const useRecentSignals = (limit = 50) =>
  useResource(`recent-signals:${limit}`, () => getRecentSignals(limit));

export const useTrackRecord = () => useResource("track-record", () => getTrackRecord());
