import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import DataTable, { Cell, type Column } from "../../components/ui/DataTable";
import Missing from "../../components/ui/Missing";
import Page from "../../components/ui/Page";
import Panel from "../../components/ui/Panel";
import PhaseIndicator, { phaseRank } from "../../components/ui/PhaseIndicator";
import SourceNote from "../../components/ui/SourceNote";
import Tag from "../../components/ui/Tag";
import { Text } from "../../components/ui/Text";
import { ColumnMenu, SearchField, Select, Toolbar } from "../../components/ui/Toolbar";
import WatchButton from "../../components/WatchButton";
import { colors, spacing } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { useFinancialHealths, useValuations } from "../../hooks/useCompanyData";
import type { Resource } from "../../hooks/useResource";
import { FRONTIER_SCORE_EXPLANATION, type CompanyRecord } from "../../types/domain";
import { applyDiscoverFilters } from "../../utils/discoverFilters";
import { formatUsdCompact } from "../../utils/format";

const DEFAULT_COLUMNS = new Set([
  "company",
  "ticker",
  "area",
  "marketCap",
  "revenue",
  "cash",
  "assets",
  "phase",
  "score",
]);

/** A number from a per-ticker resource, or why there isn't one. */
function metricCell<T>(
  ticker: string | undefined,
  resource: Resource<T | null> | undefined,
  pick: (data: T) => number | null,
  format: (value: number) => string = formatUsdCompact,
) {
  if (!ticker) return <Missing label="No ticker" />;
  if (!resource || resource.status === "loading") return <Cell muted>…</Cell>;
  if (resource.status === "error" || !resource.data) return <Missing label="n/a" />;
  const value = pick(resource.data);
  return value === null ? <Missing label="n/r" /> : <Cell numeric>{format(value)}</Cell>;
}

function metricValue<T>(
  resource: Resource<T | null> | undefined,
  pick: (data: T) => number | null,
): number | null {
  return resource?.status === "loaded" && resource.data ? pick(resource.data) : null;
}

/**
 * Company Explorer: every company BioLens tracks as one screener table.
 * Financial columns come from each company's SEC filings (and live price,
 * for market cap) and fill in as they load; a company BioLens can't value
 * shows why (No ticker, n/a, n/r) rather than a blank or a zero.
 */
export default function CompanyExplorerScreen() {
  const router = useRouter();
  const { companies, isLoading, error } = useCompanies();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [modality, setModality] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [visible, setVisible] = useState(DEFAULT_COLUMNS);

  const tickers = useMemo(
    () => companies.map((c) => c.ticker).filter((t): t is string => !!t),
    [companies],
  );
  const valuationOf = useValuations(tickers);
  const healthOf = useFinancialHealths(tickers);

  const options = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values))
        .sort()
        .map((v) => ({ value: v, label: v }));
    return {
      area: unique(companies.map((c) => c.therapeuticArea)),
      stage: unique(companies.map((c) => c.stage)).sort(
        (a, b) => (phaseRank(a.value) ?? 0) - (phaseRank(b.value) ?? 0),
      ),
      modality: unique(companies.flatMap((c) => c.modalities)),
      target: unique(companies.flatMap((c) => c.targets)),
    };
  }, [companies]);

  const rows = useMemo(() => {
    const filtered = applyDiscoverFilters(companies, {
      therapeuticArea: area ?? undefined,
      stage: (stage ?? undefined) as CompanyRecord["stage"] | undefined,
      modality: modality ?? undefined,
      target: target ?? undefined,
    });
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((c) =>
      [c.name, c.ticker ?? "", ...c.targets, ...c.pipeline.map((a) => a.drugName)].some((f) =>
        f.toLowerCase().includes(q),
      ),
    );
  }, [companies, area, stage, modality, target, query]);

  const valuation = (c: CompanyRecord) => (c.ticker ? valuationOf(c.ticker) : undefined);
  const health = (c: CompanyRecord) => (c.ticker ? healthOf(c.ticker) : undefined);

  const allColumns: (Column<CompanyRecord> & { required?: boolean })[] = [
    {
      key: "company",
      title: "Company",
      flex: 2,
      required: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <View style={styles.companyCell}>
          <WatchButton entityType="company" entityId={c.id} size={13} />
          <Cell strong>{c.name}</Cell>
          {c.reviewStatus === "ai_drafted_unreviewed" ? (
            <Tag label="AI-drafted" tone="caution" />
          ) : null}
        </View>
      ),
    },
    {
      key: "ticker",
      title: "Ticker",
      width: 84,
      sortValue: (c) => c.ticker ?? null,
      render: (c) => (c.ticker ? <Cell>{c.ticker}</Cell> : <Missing label="No ticker" />),
    },
    {
      key: "area",
      title: "Therapeutic area",
      width: 130,
      sortValue: (c) => c.therapeuticArea,
      render: (c) => <Cell>{c.therapeuticArea}</Cell>,
    },
    {
      key: "marketCap",
      title: "Market cap",
      width: 104,
      align: "right",
      sortValue: (c) => metricValue(valuation(c), (v) => v.marketCap),
      render: (c) => metricCell(c.ticker, valuation(c), (v) => v.marketCap),
    },
    {
      key: "revenue",
      title: "Revenue (TTM)",
      width: 112,
      align: "right",
      sortValue: (c) => metricValue(valuation(c), (v) => v.ttmRevenue),
      render: (c) => metricCell(c.ticker, valuation(c), (v) => v.ttmRevenue),
    },
    {
      key: "cash",
      title: "Cash & inv.",
      width: 104,
      align: "right",
      sortValue: (c) => metricValue(health(c), (h) => h.cashOnHand),
      render: (c) => metricCell(c.ticker, health(c), (h) => h.cashOnHand),
    },
    {
      key: "runway",
      title: "Runway",
      width: 88,
      align: "right",
      sortValue: (c) => metricValue(health(c), (h) => h.runwayMonths),
      render: (c) => {
        const h = health(c);
        // No runway figure because the company generated cash last quarter.
        if (
          h?.status === "loaded" &&
          h.data?.runwayMonths == null &&
          (h.data?.quarterlyBurn ?? 0) > 0
        )
          return <Cell muted>CF positive</Cell>;
        return metricCell(
          c.ticker,
          h,
          (d) => d.runwayMonths,
          (m) => `${m.toFixed(0)} mo`,
        );
      },
    },
    {
      key: "assets",
      title: "Pipeline assets",
      width: 112,
      align: "right",
      sortValue: (c) => c.pipeline.length,
      render: (c) => <Cell numeric>{c.pipeline.length}</Cell>,
    },
    {
      key: "phase",
      title: "Highest phase",
      width: 180,
      sortValue: (c) => phaseRank(c.stage),
      render: (c) => <PhaseIndicator phase={c.stage} />,
    },
    {
      key: "modality",
      title: "Modalities",
      flex: 1.4,
      render: (c) => <Cell>{c.modalities.join(", ")}</Cell>,
    },
    {
      key: "targets",
      title: "Targets",
      flex: 1.2,
      render: (c) => <Cell>{c.targets.join(", ")}</Cell>,
    },
    {
      key: "score",
      title: "Frontier score",
      width: 108,
      align: "right",
      sortValue: (c) => c.frontierScore,
      render: (c) => <Cell numeric>{c.frontierScore}</Cell>,
    },
  ];

  const columns = allColumns.filter((c) => visible.has(c.key));

  function toggleColumn(key: string) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Page
      title="Company Explorer"
      subtitle="Every company BioLens tracks, from emerging biotechs to large pharma."
      actions={
        <Pressable
          onPress={() => router.push("/compare")}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.button,
            hovered && styles.buttonHovered,
          ]}
        >
          <Text style={styles.buttonText}>Compare two companies</Text>
        </Pressable>
      }
    >
      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Company, ticker, drug or target"
        />
        <Select label="Area" value={area} options={options.area} onChange={setArea} />
        <Select label="Stage" value={stage} options={options.stage} onChange={setStage} />
        <Select
          label="Modality"
          value={modality}
          options={options.modality}
          onChange={setModality}
        />
        <Select label="Target" value={target} options={options.target} onChange={setTarget} />
        <View style={styles.spacer} />
        <ColumnMenu columns={allColumns} visible={visible} onToggle={toggleColumn} />
      </Toolbar>

      <Panel
        title="Companies"
        meta={isLoading ? undefined : `${rows.length} of ${companies.length}`}
        flush
        footer={
          <SourceNote source="SEC EDGAR filings and Yahoo Finance prices">
            BioLens calculated. No ticker = the profile has no ticker, so there are no filings or
            price to read; n/a = not computable from SEC filings (e.g. a foreign filer); n/r = not
            reported; CF positive = operating cash flow was positive last quarter, so there&apos;s
            no runway to compute. {FRONTIER_SCORE_EXPLANATION}
          </SourceNote>
        }
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <DataTable
            minWidth={1040}
            rows={rows}
            rowKey={(c) => c.id}
            columns={columns}
            initialSort={{ key: "score", direction: "desc" }}
            onRowPress={(c) => router.push({ pathname: "/company/[id]", params: { id: c.id } })}
            emptyText="No companies match these filters."
          />
        )}
      </Panel>
    </Page>
  );
}

const styles = StyleSheet.create({
  companyCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  spacer: { flex: 1 },
  loading: { padding: spacing.xl, alignItems: "center" },
  error: { padding: spacing.lg, color: colors.textSecondary },
  button: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
  },
  buttonHovered: { borderColor: colors.borderStrong, backgroundColor: colors.surface },
  buttonText: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
});
