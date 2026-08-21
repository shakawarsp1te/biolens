import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getStockQuote, StockQuote } from "../services/api";
import { colors, radii, spacing, typography } from "../constants/theme";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; quote: StockQuote };

/**
 * Factual current price for a publicly traded company — plain market data,
 * never paired with buy/sell/price-target language (see
 * api/app/services/market_data.py's module docstring for why a real
 * ticker's real price is in scope while investment advice never is). Only
 * rendered when the company profile has a ticker; silently renders nothing
 * if no quote is available (private company, delisted, or the upstream
 * source is briefly down) rather than showing a broken-looking card.
 */
export default function StockQuoteCard({ ticker }: { ticker: string }) {
  // Initial state is already "loading" — callers should pass `key={ticker}`
  // so a ticker change remounts this component with a fresh loading state,
  // rather than this effect setState-ing synchronously to reset it.
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getStockQuote(ticker)
      .then((quote) => {
        if (cancelled) return;
        setState(quote ? { status: "loaded", quote } : { status: "unavailable" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (state.status === "loading") {
    return (
      <View style={[styles.card, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (state.status === "unavailable") return null;

  const { quote } = state;
  const isUp = quote.change >= 0;
  const changeColor = isUp ? colors.gain : colors.loss;
  const sign = isUp ? "+" : "";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.ticker}>{quote.ticker}</Text>
        {quote.exchange ? <Text style={styles.exchange}>{quote.exchange}</Text> : null}
      </View>
      <Text style={styles.price}>
        {quote.currency === "USD" ? "$" : ""}
        {quote.price.toFixed(2)}
      </Text>
      <Text style={[styles.change, { color: changeColor }]}>
        {sign}
        {quote.change.toFixed(2)} ({sign}
        {quote.change_percent?.toFixed(2) ?? "—"}%)
      </Text>
      <Text style={styles.disclaimer}>Market data only — not investment advice.</Text>
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticker: {
    ...typography.caption,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  exchange: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  price: {
    ...typography.monoLarge,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  change: {
    ...typography.mono,
    marginTop: 2,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    fontWeight: "400",
  },
});
