import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Split } from "../components/company/Layout";
import DataTable, { Cell } from "../components/ui/DataTable";
import HBarList from "../components/ui/HBarList";
import Missing from "../components/ui/Missing";
import Page from "../components/ui/Page";
import Panel from "../components/ui/Panel";
import SourceNote from "../components/ui/SourceNote";
import { Text } from "../components/ui/Text";
import { colors } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { useFinancialHealths, useValuations } from "../hooks/useCompanyData";
import type { Resource } from "../hooks/useResource";
import type { FinancialHealth, Valuation } from "../services/api";
import type { CompanyRecord } from "../types/domain";
import { formatMultiple, formatPercent, formatUsdCompact } from "../utils/format";

type Row = {
  company: CompanyRecord;
  ticker: string;
  valuation: Resource<Valuation | null> | undefined;
  health: Resource<FinancialHealth | null> | undefined;
};

const loaded = <T,>(r: Resource<T | null> | undefined): T | null =>
  r?.status === "loaded" ? r.data : null;

/** A value cell that explains a gap: still loading, not computable, or
 * not reported. */
function value<T>(
  r: Resource<T | null> | undefined,
  pick: (d: T) => number | null,
  format: (n: number) => string = formatUsdCompact,
  missing = "n/r",
) {
  if (!r || r.status === "loading") return <Cell muted>…</Cell>;
  const data = loaded(r);
  if (!data) return <Missing label="n/a" />;
  const n = pick(data);
  return n === null ? <Missing label={missing} /> : <Cell numeric>{format(n)}</Cell>;
}

/**
 * Financial Analysis: balance sheet, spending and valuation side by side
 * for every tracked company with a ticker -- all from SEC filings (plus the
 * live price for market cap), BioLens calculated, never estimated.
 */
export default function FinancialAnalysisScreen() {
  const router = useRouter();
  const { companies } = useCompanies();
  const listed = useMemo(() => companies.filter((c) => c.ticker), [companies]);
  const tickers = useMemo(() => listed.map((c) => c.ticker as string), [listed]);
  const valuationOf = useValuations(tickers);
  const healthOf = useFinancialHealths(tickers);
  const unlisted = companies.filter((c) => !c.ticker);

  const rows: Row[] = listed.map((company) => ({
    company,
    ticker: company.ticker as string,
    valuation: valuationOf(company.ticker as string),
    health: healthOf(company.ticker as string),
  }));

  const runwayItems = rows
    .map((r) => {
      const h = loaded(r.health);
      const positive = h?.runwayMonths == null && (h?.quarterlyBurn ?? 0) > 0;
      return {
        key: r.company.id,
        label: r.company.name,
        value: h?.runwayMonths ?? null,
        missingLabel: positive ? "CF positive" : r.health?.status === "loading" ? "…" : "n/a",
        onPress: () =>
          router.push({
            pathname: "/company/[id]",
            params: { id: r.company.id, tab: "financials" },
          }),
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const rndItems = rows
    .map((r) => {
      const v = loaded(r.valuation);
      return {
        key: r.company.id,
        label: r.company.name,
        value: v?.ttmRnD ?? null,
        missingLabel: r.valuation?.status === "loading" ? "…" : "n/a",
        onPress: () =>
          router.push({
            pathname: "/company/[id]",
            params: { id: r.company.id, tab: "financials" },
          }),
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return (
    <Page
      title="Financial Analysis"
      subtitle="Cash, spending and valuation across every tracked company with a ticker."
    >
      <Split>
        <Panel
          title="Cash runway"
          meta="months at last quarter's operating burn"
          footer={<SourceNote source="SEC EDGAR filings">BioLens calculated</SourceNote>}
        >
          <HBarList items={runwayItems} format={(m) => `${m.toFixed(1)} mo`} />
        </Panel>
        <Panel
          title="R&D expense"
          meta="trailing 12 months, USD"
          footer={<SourceNote source="SEC EDGAR filings" />}
        >
          <HBarList items={rndItems} format={formatUsdCompact} />
        </Panel>
      </Split>

      <Panel
        title="Balance sheet and valuation"
        meta="USD"
        flush
        footer={
          <SourceNote source="SEC EDGAR filings and Yahoo Finance prices">
            BioLens calculated. n/a = not computable from SEC filings (e.g. a foreign filer); n/r =
            not reported. Multiples are facts about pricing, not a cheap/expensive judgment
            {unlisted.length > 0
              ? `. Not shown (no ticker on profile): ${unlisted.map((c) => c.name).join(", ")}`
              : ""}
          </SourceNote>
        }
      >
        <DataTable
          minWidth={1180}
          rows={rows}
          rowKey={(r) => r.company.id}
          initialSort={{ key: "marketCap", direction: "desc" }}
          onRowPress={(r) =>
            router.push({
              pathname: "/company/[id]",
              params: { id: r.company.id, tab: "financials" },
            })
          }
          columns={[
            {
              key: "company",
              title: "Company",
              flex: 1.6,
              sortValue: (r) => r.company.name,
              render: (r) => <Cell strong>{r.company.name}</Cell>,
            },
            { key: "ticker", title: "Ticker", width: 76, render: (r) => <Cell>{r.ticker}</Cell> },
            {
              key: "marketCap",
              title: "Market cap",
              width: 100,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.marketCap ?? null,
              render: (r) => value(r.valuation, (v) => v.marketCap),
            },
            {
              key: "ev",
              title: "Ent. value",
              width: 100,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.enterpriseValue ?? null,
              render: (r) => value(r.valuation, (v) => v.enterpriseValue),
            },
            {
              key: "cash",
              title: "Cash & inv.",
              width: 100,
              align: "right",
              sortValue: (r) => loaded(r.health)?.cashOnHand ?? null,
              render: (r) => value(r.health, (h) => h.cashOnHand),
            },
            {
              key: "debt",
              title: "Total debt",
              width: 96,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.totalDebt ?? null,
              render: (r) => value(r.valuation, (v) => v.totalDebt),
            },
            {
              key: "netCash",
              title: "Net cash / mkt cap",
              width: 130,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.netCashToMarketCap ?? null,
              render: (r) =>
                value(
                  r.valuation,
                  (v) => v.netCashToMarketCap,
                  (n) => formatPercent(n),
                ),
            },
            {
              key: "revenue",
              title: "Revenue (TTM)",
              width: 110,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.ttmRevenue ?? null,
              render: (r) => value(r.valuation, (v) => v.ttmRevenue),
            },
            {
              key: "rnd",
              title: "R&D (TTM)",
              width: 100,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.ttmRnD ?? null,
              render: (r) => value(r.valuation, (v) => v.ttmRnD),
            },
            {
              key: "evRev",
              title: "EV / revenue",
              width: 100,
              align: "right",
              sortValue: (r) => loaded(r.valuation)?.evToRevenue ?? null,
              render: (r) => value(r.valuation, (v) => v.evToRevenue, formatMultiple, "n/m"),
            },
            {
              key: "burn",
              title: "Op. cash flow (qtr)",
              width: 130,
              align: "right",
              sortValue: (r) => loaded(r.health)?.quarterlyBurn ?? null,
              render: (r) => value(r.health, (h) => h.quarterlyBurn),
            },
            {
              key: "runway",
              title: "Runway",
              width: 84,
              align: "right",
              sortValue: (r) => loaded(r.health)?.runwayMonths ?? null,
              render: (r) => {
                const h = loaded(r.health);
                if (h && h.runwayMonths == null && (h.quarterlyBurn ?? 0) > 0)
                  return <Cell muted>CF positive</Cell>;
                return value(
                  r.health,
                  (d) => d.runwayMonths,
                  (m) => `${m.toFixed(0)} mo`,
                );
              },
            },
          ]}
        />
      </Panel>
      <Text style={styles.note}>
        EV / revenue shows n/m (not meaningful) under $50M of revenue or when enterprise value is
        negative, where the multiple is noise rather than signal.
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: colors.textTertiary },
});
