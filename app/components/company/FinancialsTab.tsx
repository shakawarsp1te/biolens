import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, numeric, spacing, typography } from "../../constants/theme";
import { useFinancialHistory, useValuation } from "../../hooks/useCompanyData";
import type { AnnualFinancials } from "../../services/api";
import type { CompanyRecord } from "../../types/domain";
import { formatPercent, formatUsdAxis, formatUsdCompact } from "../../utils/format";
import BarChart from "../ui/BarChart";
import Missing from "../ui/Missing";
import Panel from "../ui/Panel";
import SourceNote from "../ui/SourceNote";
import { Text } from "../ui/Text";
import { Split, Stack } from "./Layout";
import { KeyDataPanel, PanelState, RunwayPanel } from "./panels";

// Below this revenue an operating margin is dominated by noise (a clinical-
// stage company's collaboration income) -- same threshold valuation.py uses
// before it shows an EV/revenue multiple.
const MIN_REVENUE_FOR_MARGIN = 50_000_000;

type Metric = {
  label: string;
  value: (year: AnnualFinancials) => number | null;
  format: (value: number) => string;
  /** Shown in place of a null value. */
  missing: string;
  calculated?: boolean;
};

const METRICS: Metric[] = [
  { label: "Revenue", value: (y) => y.revenue, format: formatUsdCompact, missing: "Not reported" },
  {
    label: "R&D expense",
    value: (y) => y.researchAndDevelopment,
    format: formatUsdCompact,
    missing: "Not reported",
  },
  {
    label: "Operating income (loss)",
    value: (y) => y.operatingIncome,
    format: formatUsdCompact,
    missing: "Not reported",
  },
  {
    label: "Net income (loss)",
    value: (y) => y.netIncome,
    format: formatUsdCompact,
    missing: "Not reported",
  },
  {
    label: "R&D as % of revenue",
    value: (y) =>
      y.revenue && y.revenue >= MIN_REVENUE_FOR_MARGIN && y.researchAndDevelopment != null
        ? y.researchAndDevelopment / y.revenue
        : null,
    format: (v) => formatPercent(v),
    missing: "n/m",
    calculated: true,
  },
  {
    label: "Operating margin",
    value: (y) =>
      y.revenue && y.revenue >= MIN_REVENUE_FOR_MARGIN && y.operatingIncome != null
        ? y.operatingIncome / y.revenue
        : null,
    format: (v) => formatPercent(v),
    missing: "n/m",
    calculated: true,
  },
];

export default function FinancialsTab({ company }: { company: CompanyRecord }) {
  const history = useFinancialHistory(company.ticker);
  const valuation = useValuation(company.ticker);
  const years = history?.status === "loaded" ? (history.data?.years ?? []) : [];
  const v = valuation?.status === "loaded" ? valuation.data : null;
  const categories = years.map((y) => `FY${y.year}`);

  if (!company.ticker) {
    return (
      <Panel title="Financials">
        <Missing label="No ticker on this profile, so there are no filings to read" />
      </Panel>
    );
  }

  const source = (
    <SourceNote source="SEC EDGAR 10-K filings">
      fiscal years by period-end year; latest filed figure, so restatements apply
    </SourceNote>
  );

  return (
    <Stack>
      <Split>
        <Panel title="Revenue and R&D" meta="Annual, USD" footer={source}>
          {years.length > 0 ? (
            <BarChart
              categories={categories}
              series={[
                {
                  name: "Revenue",
                  color: colors.chartSeries[0],
                  values: years.map((y) => y.revenue),
                },
                {
                  name: "R&D expense",
                  color: colors.chartSeries[1],
                  values: years.map((y) => y.researchAndDevelopment),
                },
              ]}
              formatValue={formatUsdCompact}
              formatAxis={formatUsdAxis}
            />
          ) : (
            <PanelState
              resource={history}
              empty="No annual figures in this company's 10-K filings"
            />
          )}
        </Panel>
        <Panel title="Net income (loss)" meta="Annual, USD" footer={source}>
          {years.length > 0 ? (
            <BarChart
              categories={categories}
              series={[
                {
                  name: "Net income",
                  color: colors.chartNeutral,
                  values: years.map((y) => y.netIncome),
                },
              ]}
              formatValue={formatUsdCompact}
              formatAxis={formatUsdAxis}
            />
          ) : (
            <PanelState
              resource={history}
              empty="No annual figures in this company's 10-K filings"
            />
          )}
        </Panel>
      </Split>

      {years.length > 0 ? (
        <Panel
          title="Income statement"
          meta="Annual, USD"
          flush
          footer={
            <SourceNote source="SEC EDGAR 10-K filings">
              ratios are BioLens calculated; n/m = not meaningful (revenue under $50M)
            </SourceNote>
          }
        >
          <IncomeTable years={years} />
        </Panel>
      ) : null}

      <Split>
        <KeyDataPanel ticker={company.ticker} title="Valuation & balance sheet" />
        <Stack>
          <RunwayPanel ticker={company.ticker} />
          {v && v.notes.length > 0 ? (
            <Panel title="Calculation notes">
              {v.notes.map((note, i) => (
                <Text key={i} style={styles.note}>
                  {note}
                </Text>
              ))}
            </Panel>
          ) : null}
        </Stack>
      </Split>
    </Stack>
  );
}

const LABEL_WIDTH = 200;

function IncomeTable({ years }: { years: AnnualFinancials[] }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { width: LABEL_WIDTH, textAlign: "left" }]}>Fiscal year</Text>
          {years.map((y) => (
            <Text key={y.year} style={[styles.th, styles.yearCol]}>
              FY{y.year}
            </Text>
          ))}
        </View>
        {METRICS.map((metric) => (
          <View key={metric.label} style={styles.tr}>
            <Text style={[styles.rowLabel, { width: LABEL_WIDTH }]}>
              {metric.label}
              {metric.calculated ? <Text style={styles.calc}> · calc.</Text> : null}
            </Text>
            {years.map((y) => {
              const value = metric.value(y);
              return (
                <View key={y.year} style={[styles.td, styles.yearCol]}>
                  {value === null ? (
                    <Missing label={metric.missing} />
                  ) : (
                    <Text style={[styles.value, value < 0 && styles.negative]}>
                      {value < 0 && !metric.calculated
                        ? `(${metric.format(-value)})`
                        : metric.format(value)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  tableScroll: { flexGrow: 1 },
  table: { flex: 1, minWidth: 720 },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
  },
  thead: { borderBottomColor: colors.border, minHeight: 32 },
  th: { ...typography.caption, fontWeight: "500", color: colors.textTertiary, textAlign: "right" },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  calc: { ...typography.caption, color: colors.textTertiary },
  td: { alignItems: "flex-end" },
  // Years share the leftover width, but never squeeze below a readable
  // figure -- the table scrolls sideways first.
  yearCol: { flex: 1, minWidth: 100 },
  value: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, ...numeric },
  // Losses in parentheses (accounting convention) and a quieter tone --
  // not red: a clinical-stage loss is the normal state, not an alarm.
  negative: { color: colors.textSecondary },
});
