import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { colors, numeric, spacing, typography } from "../../constants/theme";
import {
  useCatalysts,
  useCompetitors,
  useFinancialHealth,
  usePriceHistory,
  useQuote,
  useValuation,
} from "../../hooks/useCompanyData";
import type { Resource } from "../../hooks/useResource";
import type { ChartRange, Competitor } from "../../services/api";
import type { CatalystEvent, CompanyRecord } from "../../types/domain";
import { currencyPrefix } from "../../utils/currency";
import {
  disclosed,
  formatIsoDate,
  formatMultiple,
  formatPercent,
  formatUsdCompact,
} from "../../utils/format";
import PriceChart from "../PriceChart";
import DataTable, { Cell } from "../ui/DataTable";
import KeyValueTable from "../ui/KeyValueTable";
import Missing from "../ui/Missing";
import Panel from "../ui/Panel";
import PhaseIndicator, { phaseRank } from "../ui/PhaseIndicator";
import SourceNote from "../ui/SourceNote";
import { Text } from "../ui/Text";
import type { CompanyTabKey } from "../shell/routes";

export const CT_GOV_URL = "https://clinicaltrials.gov/study/";
const SEC_SOURCE = "SEC EDGAR filings";

/** Small text button for a panel header ("Full pipeline →"). */
export function PanelLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {({ hovered }: { hovered?: boolean }) => (
        <Text style={[styles.panelLink, hovered && styles.panelLinkHovered]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Loading / error / empty body for a panel whose data isn't ready. */
export function PanelState({
  resource,
  empty,
}: {
  resource: Resource<unknown> | null;
  empty: string;
}) {
  if (resource?.status === "loading") return <Text style={styles.stateText}>Loading…</Text>;
  if (resource?.status === "error")
    return (
      <Text style={styles.stateText}>Couldn&apos;t load this right now. {resource.message}</Text>
    );
  return <Missing label={empty} />;
}

// --- Price ---------------------------------------------------------------

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y"];

export function PricePanel({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<ChartRange>("3M");
  const [width, setWidth] = useState(0);
  const quote = useQuote(ticker);
  const history = usePriceHistory(ticker, range);
  const q = quote?.status === "loaded" ? quote.data : null;
  const points = history?.status === "loaded" ? (history.data?.points ?? []) : [];
  const prefix = currencyPrefix(q?.currency);

  return (
    <Panel
      title="Price"
      meta={q?.currency ?? undefined}
      action={
        <View style={styles.ranges}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.range, r === range && styles.rangeActive]}
              accessibilityState={{ selected: r === range }}
            >
              <Text style={[styles.rangeText, r === range && styles.rangeTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
      }
      footer={
        <SourceNote source="Yahoo Finance">prices may be delayed; not investment advice</SourceNote>
      }
    >
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {quote?.status === "loaded" && !q ? (
          <Missing label="No market data for this ticker right now" />
        ) : points.length > 1 && width > 0 ? (
          <PriceChart points={points} width={width} height={200} />
        ) : (
          <View style={styles.chartPlaceholder}>
            <PanelState resource={history} empty="No price history for this range" />
          </View>
        )}
      </View>
      {q ? (
        <View style={styles.priceStats}>
          <PriceStat
            label="Day range"
            value={
              q.day_low != null && q.day_high != null
                ? `${prefix}${q.day_low.toFixed(2)} – ${prefix}${q.day_high.toFixed(2)}`
                : null
            }
          />
          <PriceStat
            label="52-week range"
            value={
              q.fifty_two_week_low != null && q.fifty_two_week_high != null
                ? `${prefix}${q.fifty_two_week_low.toFixed(2)} – ${prefix}${q.fifty_two_week_high.toFixed(2)}`
                : null
            }
          />
          <PriceStat label="Previous close" value={`${prefix}${q.previous_close.toFixed(2)}`} />
          <PriceStat label="Volume" value={q.volume != null ? q.volume.toLocaleString() : null} />
        </View>
      ) : null}
    </Panel>
  );
}

function PriceStat({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.priceStat}>
      <Text style={styles.priceStatLabel}>{label}</Text>
      {value ? (
        <Text style={styles.priceStatValue}>{value}</Text>
      ) : (
        <Missing label="Not reported" />
      )}
    </View>
  );
}

// --- Key data / valuation ------------------------------------------------

export function KeyDataPanel({ ticker, title = "Key data" }: { ticker?: string; title?: string }) {
  const valuation = useValuation(ticker);
  const v = valuation?.status === "loaded" ? valuation.data : null;

  return (
    <Panel
      title={title}
      meta="USD"
      footer={
        v ? (
          <SourceNote
            source={SEC_SOURCE}
            url={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}`}
          >
            shares as of {formatIsoDate(v.sharesAsOf)}; BioLens calculated with the live price
          </SourceNote>
        ) : null
      }
    >
      {!ticker ? (
        <Missing label="Private company: no public filings or market price" />
      ) : !v ? (
        <PanelState
          resource={valuation}
          empty="Not computable: BioLens only values US-GAAP filers with a USD listing"
        />
      ) : (
        <KeyValueTable
          rows={[
            { label: "Market cap", value: formatUsdCompact(v.marketCap) },
            {
              label: "Enterprise value",
              value: v.enterpriseValue != null ? formatUsdCompact(v.enterpriseValue) : null,
              missingLabel: "Not computable",
            },
            {
              label: "Cash & investments",
              value: v.cashAndInvestments != null ? formatUsdCompact(v.cashAndInvestments) : null,
              detail: v.cashAsOf ? `As of ${formatIsoDate(v.cashAsOf)}` : null,
              missingLabel: "Not reported",
            },
            {
              label: "Total debt",
              value: v.totalDebt != null ? formatUsdCompact(v.totalDebt) : null,
              detail: v.debtAsOf ? `As of ${formatIsoDate(v.debtAsOf)}` : null,
              missingLabel: "None tagged in filings",
            },
            {
              label: "Revenue (TTM)",
              value: v.ttmRevenue != null ? formatUsdCompact(v.ttmRevenue) : null,
              detail: v.ttmRevenueThrough ? `Through ${formatIsoDate(v.ttmRevenueThrough)}` : null,
              missingLabel: "Not reported",
            },
            {
              label: "R&D expense (TTM)",
              value: v.ttmRnD != null ? formatUsdCompact(v.ttmRnD) : null,
              detail: v.ttmRnDThrough ? `Through ${formatIsoDate(v.ttmRnDThrough)}` : null,
              missingLabel: "Not reported",
            },
            {
              label: "EV / revenue",
              value: v.evToRevenue != null ? formatMultiple(v.evToRevenue) : null,
              missingLabel: "Not meaningful",
            },
            {
              label: "Net cash / market cap",
              value: v.netCashToMarketCap != null ? formatPercent(v.netCashToMarketCap) : null,
              missingLabel: "Not computable",
            },
          ]}
        />
      )}
    </Panel>
  );
}

// --- Cash runway ---------------------------------------------------------

export function RunwayPanel({ ticker }: { ticker?: string }) {
  const health = useFinancialHealth(ticker);
  const h = health?.status === "loaded" ? health.data : null;

  return (
    <Panel
      title="Cash & runway"
      footer={
        h ? (
          <SourceNote source={SEC_SOURCE}>
            BioLens calculated from {h.filingForm ?? "filings"} as of {formatIsoDate(h.cashAsOf)}
          </SourceNote>
        ) : null
      }
    >
      {!ticker ? (
        <Missing label="Private company: no public filings" />
      ) : !h ? (
        <PanelState resource={health} empty="No cash or burn figures in this company's filings" />
      ) : (
        <>
          <KeyValueTable
            rows={[
              {
                label: "Cash & investments",
                value: formatUsdCompact(h.cashOnHand),
                detail:
                  h.marketableSecurities && h.cashAndEquivalents != null
                    ? `${formatUsdCompact(h.cashAndEquivalents)} cash + ${formatUsdCompact(h.marketableSecurities)} securities`
                    : null,
              },
              {
                label: "Operating cash flow, last quarter",
                value:
                  h.quarterlyBurn != null
                    ? `${h.quarterlyBurn > 0 ? "+" : ""}${formatUsdCompact(h.quarterlyBurn)}`
                    : null,
                detail: h.burnIsEstimated ? "Derived from year-to-date figures" : null,
                missingLabel: "Not reported",
              },
              {
                label: "Runway at that burn",
                value: h.runwayMonths != null ? `${h.runwayMonths.toFixed(1)} months` : null,
                missingLabel:
                  h.quarterlyBurn != null && h.quarterlyBurn > 0
                    ? "Cash-flow positive"
                    : "Not computable",
              },
            ]}
          />
          {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
        </>
      )}
    </Panel>
  );
}

// --- Milestones ----------------------------------------------------------

export const EVENT_LABEL: Record<CatalystEvent["eventType"], string> = {
  primary_completion: "Primary completion",
  completion: "Study completion",
};

export function catalystDate(event: CatalystEvent): string {
  return formatIsoDate(event.expectedDate, event.hasDayPrecision);
}

export function MilestonesPanel({
  companyId,
  limit = 4,
  onViewAll,
}: {
  companyId: string;
  limit?: number;
  onViewAll?: () => void;
}) {
  const catalysts = useCatalysts(companyId);
  const events = catalysts?.status === "loaded" ? catalysts.data : [];

  return (
    <Panel
      title="Upcoming milestones"
      action={
        onViewAll && events.length > 0 ? (
          <PanelLink label="All catalysts →" onPress={onViewAll} />
        ) : null
      }
      flush={events.length > 0}
      footer={
        events.length > 0 ? (
          <SourceNote source="ClinicalTrials.gov">
            sponsor-disclosed estimates; they move
          </SourceNote>
        ) : null
      }
    >
      {events.length === 0 ? (
        <PanelState
          resource={catalysts}
          empty="No upcoming dates disclosed on ClinicalTrials.gov"
        />
      ) : (
        events.slice(0, limit).map((event) => (
          <View key={event.id} style={styles.milestone}>
            <View style={styles.milestoneDate}>
              <Text style={styles.milestoneDateText}>{catalystDate(event)}</Text>
              <Text style={styles.milestoneBasis}>
                {event.dateType === "ESTIMATED" ? "Estimated" : "Actual"}
              </Text>
            </View>
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneTitle} numberOfLines={2}>
                {EVENT_LABEL[event.eventType]} · {event.title}
              </Text>
              <Text style={styles.link} onPress={() => Linking.openURL(event.sourceUrl)}>
                {event.nctId}
                {event.phase ? <Text style={styles.milestoneBasis}> · {event.phase}</Text> : null}
              </Text>
            </View>
          </View>
        ))
      )}
    </Panel>
  );
}

// --- Pipeline summary ----------------------------------------------------

export function PipelineSummaryPanel({
  company,
  onViewAll,
}: {
  company: CompanyRecord;
  onViewAll: () => void;
}) {
  const assets = [...company.pipeline].sort(
    (a, b) => (phaseRank(b.stage) ?? 0) - (phaseRank(a.stage) ?? 0),
  );
  return (
    <Panel
      title="Clinical pipeline"
      meta={`${assets.length} asset${assets.length === 1 ? "" : "s"}`}
      action={<PanelLink label="Full pipeline →" onPress={onViewAll} />}
      flush
    >
      <DataTable
        minWidth={520}
        rows={assets.slice(0, 6)}
        rowKey={(a) => a.drugId}
        onRowPress={onViewAll}
        emptyText="No pipeline assets on this profile."
        columns={[
          {
            key: "drug",
            title: "Therapy",
            flex: 1.2,
            render: (a) => <Cell strong>{a.drugName}</Cell>,
          },
          {
            key: "disease",
            title: "Indication",
            flex: 1.6,
            render: (a) => <Cell>{a.disease}</Cell>,
          },
          {
            key: "target",
            title: "Target",
            flex: 1,
            render: (a) =>
              disclosed(a.target) ? <Cell>{a.target}</Cell> : <Missing label="Not disclosed" />,
          },
          {
            key: "phase",
            title: "Stage",
            width: 190,
            render: (a) => <PhaseIndicator phase={a.stage} />,
          },
        ]}
      />
    </Panel>
  );
}

// --- Competition ---------------------------------------------------------

type CompetitorRow = Competitor & { overlap: string[] };

/** Competitors across all of a company's assets, merged by company. */
export function useCompetitorRows(companyId: string) {
  const resource = useCompetitors(companyId);
  const rows = useMemo(() => {
    if (resource?.status !== "loaded") return [];
    const byCompany = new Map<string, CompetitorRow>();
    for (const asset of resource.data) {
      if (!asset.searchable || !asset.available) continue;
      for (const c of asset.competitors) {
        const existing = byCompany.get(c.company);
        if (!existing) {
          // Copy the arrays: later merges append to them, and `c` is the
          // shared cached response.
          byCompany.set(c.company, {
            ...c,
            drugs: [...c.drugs],
            trials: [...c.trials],
            overlap: [asset.target],
          });
          continue;
        }
        if (!existing.overlap.includes(asset.target)) existing.overlap.push(asset.target);
        if ((phaseRank(c.mostAdvancedPhase) ?? 0) > (phaseRank(existing.mostAdvancedPhase) ?? 0))
          existing.mostAdvancedPhase = c.mostAdvancedPhase;
        const known = new Set(existing.trials.map((t) => t.nctId));
        for (const t of c.trials) if (!known.has(t.nctId)) existing.trials.push(t);
        existing.trialCount = existing.trials.length;
        existing.drugs = Array.from(new Set([...existing.drugs, ...c.drugs]));
      }
    }
    return Array.from(byCompany.values());
  }, [resource]);
  return { resource, rows };
}

export function CompetitorsTable({ rows, limit }: { rows: CompetitorRow[]; limit?: number }) {
  const router = useRouter();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <DataTable
      minWidth={620}
      rows={shown}
      rowKey={(c) => c.company}
      initialSort={{ key: "phase", direction: "desc" }}
      columns={[
        {
          key: "company",
          title: "Company",
          flex: 1.5,
          sortValue: (c) => c.company,
          render: (c) =>
            c.trackedCompanyId ? (
              <Text
                style={styles.link}
                numberOfLines={1}
                onPress={() =>
                  router.push({
                    pathname: "/company/[id]",
                    params: { id: c.trackedCompanyId as string },
                  })
                }
              >
                {c.company}
              </Text>
            ) : (
              <Cell strong>{c.company}</Cell>
            ),
        },
        {
          key: "ticker",
          title: "Ticker",
          width: 70,
          render: (c) => <Cell muted={!c.ticker}>{c.ticker ?? "—"}</Cell>,
        },
        {
          key: "target",
          title: "Same target",
          flex: 1,
          render: (c) => <Cell>{c.overlap.join(", ")}</Cell>,
        },
        {
          key: "drugs",
          title: "Their drugs",
          flex: 1.5,
          render: (c) => (
            <Cell muted={c.drugs.length === 0}>{c.drugs.join(", ") || "Not named"}</Cell>
          ),
        },
        {
          key: "phase",
          title: "Most advanced",
          width: 120,
          sortValue: (c) => phaseRank(c.mostAdvancedPhase),
          render: (c) => <Cell>{c.mostAdvancedPhase}</Cell>,
        },
        {
          key: "trials",
          title: "Active trials",
          width: 96,
          align: "right",
          sortValue: (c) => c.trialCount,
          render: (c) => <Cell numeric>{c.trialCount}</Cell>,
        },
      ]}
    />
  );
}

export function CompetitionPanel({
  companyId,
  limit,
  onViewAll,
}: {
  companyId: string;
  limit?: number;
  onViewAll?: () => void;
}) {
  const { resource, rows } = useCompetitorRows(companyId);
  return (
    <Panel
      title="Competitive landscape"
      meta={
        rows.length
          ? `${rows.length} companies with Phase II+ trials on the same targets`
          : undefined
      }
      action={
        onViewAll && rows.length > (limit ?? 0) ? (
          <PanelLink label="All competitors →" onPress={onViewAll} />
        ) : null
      }
      flush={rows.length > 0}
      footer={
        <SourceNote source="ClinicalTrials.gov">
          active industry trials naming the same target; a trial that names only its drug isn&apos;t
          found
        </SourceNote>
      }
    >
      {rows.length === 0 ? (
        <PanelState
          resource={resource}
          empty="No competing Phase II+ trials found on these targets"
        />
      ) : (
        <CompetitorsTable rows={rows} limit={limit} />
      )}
    </Panel>
  );
}

// --- Summary & risks -----------------------------------------------------

export function SummaryPanel({ company }: { company: CompanyRecord }) {
  return (
    <Panel
      title="BioLens summary"
      footer={
        <SourceNote
          source={
            company.source === "auto_discovery"
              ? "AI-drafted from ClinicalTrials.gov data"
              : "BioLens research profile"
          }
        >
          {company.lastVerifiedAt
            ? `verified ${formatIsoDate(company.lastVerifiedAt)}`
            : company.reviewStatus === "ai_drafted_unreviewed"
              ? "not yet reviewed"
              : `updated ${formatIsoDate(company.updatedAt)}`}
        </SourceNote>
      }
    >
      <Text style={styles.paragraph}>{company.biolensSummary}</Text>
      <Text style={styles.subhead}>Technology</Text>
      <Text style={styles.paragraph}>{company.technology}</Text>
    </Panel>
  );
}

export function RisksPanel({ company }: { company: CompanyRecord }) {
  return (
    <Panel title="Key risks">
      <View style={styles.keyRisk}>
        <Text style={styles.keyRiskText}>{company.keyRisk}</Text>
      </View>
      {company.thesisMap.whatCouldGoWrong.map((risk, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={[styles.listIndex, numeric]}>{i + 1}</Text>
          <Text style={styles.listText}>{risk}</Text>
        </View>
      ))}
    </Panel>
  );
}

export function NumberedList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={[styles.listIndex, numeric]}>{i + 1}</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export type GoToTab = (tab: CompanyTabKey) => void;

const styles = StyleSheet.create({
  panelLink: { fontSize: 12, fontWeight: "500", color: colors.accent },
  panelLinkHovered: { textDecorationLine: "underline" },
  stateText: { ...typography.label, fontWeight: "400", color: colors.textTertiary },
  ranges: { flexDirection: "row", gap: 2 },
  range: { paddingHorizontal: 7, height: 22, justifyContent: "center", borderRadius: 2 },
  rangeActive: { backgroundColor: colors.surfaceRaised },
  rangeText: { fontSize: 11, fontWeight: "500", color: colors.textTertiary },
  rangeTextActive: { color: colors.textPrimary },
  chartPlaceholder: { height: 200, justifyContent: "center", alignItems: "center" },
  priceStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    rowGap: spacing.sm,
  },
  priceStat: { minWidth: 140, flex: 1, gap: 2 },
  priceStatLabel: { ...typography.caption, color: colors.textTertiary },
  priceStatValue: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, ...numeric },
  note: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  milestone: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  milestoneDate: { width: 92 },
  milestoneDateText: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, ...numeric },
  milestoneBasis: { ...typography.caption, color: colors.textTertiary },
  milestoneBody: { flex: 1, gap: 2 },
  milestoneTitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  link: { fontSize: 12, color: colors.accent },
  paragraph: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  subhead: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textTertiary,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  keyRisk: {
    borderLeftWidth: 2,
    borderLeftColor: colors.confidenceModerate,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  keyRiskText: { fontSize: 13, lineHeight: 19, color: colors.textPrimary },
  listRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  listIndex: { width: 16, fontSize: 12, color: colors.textTertiary, paddingTop: 1 },
  listText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
});
