import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FilterPill from "../components/FilterPill";
import PriceChart from "../components/PriceChart";
import { colors, radii, spacing, typography } from "../constants/theme";
import {
  ChartRange,
  getStockHistory,
  getStockQuote,
  StockHistoryPoint,
  StockQuote,
} from "../services/api";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y"];
const CHART_HEIGHT = 220;

/**
 * The detailed view a tap on StockQuoteCard's compact chart opens — bigger
 * chart, a range picker, and the full stat grid. Same PriceChart component
 * as the compact card (crosshair scrubbing works identically here), just
 * without an onExpand since there's nowhere further to drill into.
 */
export default function StockDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>("1M");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  // Keyed by range so a stale response for a range the user has since
  // switched away from is never rendered, without needing to setState(null)
  // synchronously at the top of the effect (that's still true while a new
  // range's fetch is in flight — the old chart stays up until it resolves).
  const [historyByRange, setHistoryByRange] = useState<Partial<Record<ChartRange, StockHistoryPoint[]>>>(
    {},
  );
  const [chartWidth, setChartWidth] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    getStockQuote(ticker)
      .then(setQuote)
      .catch(() => setError(true));
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    getStockHistory(ticker, range)
      .then((result) => setHistoryByRange((prev) => ({ ...prev, [range]: result?.points ?? [] })))
      .catch(() => setHistoryByRange((prev) => ({ ...prev, [range]: [] })));
  }, [ticker, range]);

  const history = historyByRange[range] ?? null;

  function handleLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  if (!ticker || error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load market data for this company.</Text>
      </View>
    );
  }

  const isUp = (quote?.change ?? 0) >= 0;
  const changeColor = isUp ? colors.gain : colors.loss;
  const sign = isUp ? "+" : "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.ticker}>{ticker}</Text>
          {quote?.company_name ? <Text style={styles.companyName}>{quote.company_name}</Text> : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {quote ? (
        <>
          <Text style={styles.price}>
            {quote.currency === "USD" ? "$" : ""}
            {quote.price.toFixed(2)}
          </Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {sign}
            {quote.change.toFixed(2)} ({sign}
            {quote.change_percent?.toFixed(2) ?? "—"}%)
          </Text>
        </>
      ) : (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <FilterPill key={r} label={r} selected={range === r} onPress={() => setRange(r)} />
        ))}
      </View>

      <View style={styles.chartWrap} onLayout={handleLayout}>
        {chartWidth > 0 ? (
          history === null ? (
            <View style={[styles.centeredRow, { height: CHART_HEIGHT }]}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <PriceChart points={history} width={chartWidth} height={CHART_HEIGHT} />
          )
        ) : null}
      </View>

      {quote ? (
        <View style={styles.statsGrid}>
          <StatCell label="Day range" value={formatRange(quote.day_low, quote.day_high)} />
          <StatCell
            label="52-week range"
            value={formatRange(quote.fifty_two_week_low, quote.fifty_two_week_high)}
          />
          <StatCell label="Volume" value={quote.volume ? quote.volume.toLocaleString() : "—"} />
          <StatCell label="Exchange" value={quote.exchange ?? "—"} />
        </View>
      ) : null}

      <Text style={styles.disclaimer}>
        Market data only — not investment advice. Prices may be delayed and are provided by a
        third-party source (Yahoo Finance) BioLens doesn&apos;t control.
      </Text>
    </ScrollView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null || high == null) return "—";
  return `$${low.toFixed(2)} – $${high.toFixed(2)}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ticker: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
  },
  companyName: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  price: {
    ...typography.hero,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  change: {
    ...typography.mono,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  rangeRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
  },
  chartWrap: {
    marginTop: spacing.md,
    height: 220,
  },
  centeredRow: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  statCell: {
    width: "45%",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  statValue: {
    ...typography.mono,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
