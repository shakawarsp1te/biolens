import {
  ChartRange,
  getCompanyCatalysts,
  getCompanyCompetitors,
  getCompanySignals,
  getFinancialHealth,
  getFinancialHistory,
  getStockHistory,
  getStockQuote,
  getValuation,
} from "../services/api";
import { useResource } from "./useResource";

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
