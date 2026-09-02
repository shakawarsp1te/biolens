import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { getStockHistory, getStockQuote, StockHistoryPoint, StockQuote } from "../services/api";
import PriceChart from "./PriceChart";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; quote: StockQuote; history: StockHistoryPoint[] };

const CHART_HEIGHT = 90;
// The compact card's default zoom — 1 month reads as "recent trend" at a
// glance; the detailed view (app/app/stock-detail.tsx) is where someone
// picks a different range.
const DEFAULT_RANGE = "1M";

/**
 * Factual current price for a publicly traded company — plain market data,
 * never paired with buy/sell/price-target language (see
 * api/app/services/market_data.py's module docstring for why a real
 * ticker's real price is in scope while investment advice never is). Only
 * rendered when the company profile has a ticker; silently renders nothing
 * if no quote is available (private company, delisted, or the upstream
 * source is briefly down) rather than showing a broken-looking card.
 *
 * Includes a compact price chart — drag to scrub a crosshair for the price
 * at that moment, tap (not drag) to open the full detailed view.
 */
export default function StockQuoteCard({ ticker }: { ticker: string }) {
  // Initial state is already "loading" — callers should pass `key={ticker}`
  // so a ticker change remounts this component with a fresh loading state,
  // rather than this effect setState-ing synchronously to reset it.
  const [state, setState] = useState<State>({ status: "loading" });
  const [chartWidth, setChartWidth] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStockQuote(ticker), getStockHistory(ticker, DEFAULT_RANGE)])
      .then(([quote, history]) => {
        if (cancelled) return;
        setState(
          quote ? { status: "loaded", quote, history: history?.points ?? [] } : { status: "unavailable" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  function handleLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  if (state.status === "loading") {
    return (
      <View style={[styles.card, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (state.status === "unavailable") return null;

  const { quote, history } = state;
  const isUp = quote.change >= 0;
  const changeColor = isUp ? colors.gain : colors.loss;
  const sign = isUp ? "+" : "";

  function openDetail() {
    router.push({ pathname: "/stock-detail", params: { ticker: quote.ticker } });
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={openDetail}>
        <Text style={styles.price}>
          {quote.currency === "USD" ? "$" : ""}
          {quote.price.toFixed(2)}
        </Text>
        <Text style={[styles.change, { color: changeColor }]}>
          {sign}
          {quote.change.toFixed(2)} ({sign}
          {quote.change_percent?.toFixed(2) ?? "—"}%) · {DEFAULT_RANGE}
        </Text>
      </Pressable>

      <View style={styles.chartWrap} onLayout={handleLayout}>
        {chartWidth > 0 && history.length > 1 ? (
          <PriceChart points={history} width={chartWidth} height={CHART_HEIGHT} onExpand={openDetail} />
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Pressable onPress={openDetail} hitSlop={8}>
          <Text style={styles.detailLink}>View detailed chart ›</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Not investment advice.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 88,
  },
  price: {
    ...typography.monoLarge,
    fontSize: 28,
    color: colors.textPrimary,
  },
  change: {
    ...typography.mono,
    fontSize: 13,
    marginTop: 2,
  },
  chartWrap: {
    marginTop: spacing.sm,
    height: CHART_HEIGHT,
  },
  footerRow: {
    // Stacked, not a row split with space-between: at a narrow width (a
    // phone, or this card in a narrow web viewport) two independently-
    // wrapping text nodes sharing one row wrap unpredictably against each
    // other. Vertical is robust at any width.
    marginTop: spacing.sm,
    gap: 2,
  },
  detailLink: {
    ...typography.body,
    fontSize: 13,
    color: colors.accent,
    fontWeight: "700",
  },
  disclaimer: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
  },
});
