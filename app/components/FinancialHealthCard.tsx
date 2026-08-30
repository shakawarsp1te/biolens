import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { getFinancialHealth } from "../services/api";
import ListContainer from "./ListContainer";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; cashOnHand: string; runwayLabel: string; burnLabel: string | null; note: string | null; asOf: string };

function formatMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * Cash on hand and the runway it implies — computed deterministically from
 * the company's own SEC filings (api/app/services/financial_health.py),
 * never an LLM estimate. Fetches independently on mount, exactly like
 * StockQuoteCard's quote/history, since this is a separate slower external
 * call that shouldn't block the rest of the profile — silently renders
 * nothing if unavailable (a private company, or a filer this parser
 * couldn't read), same graceful-degradation contract as market data
 * elsewhere in this app.
 */
export default function FinancialHealthCard({ ticker }: { ticker: string }) {
  // Initial state is already "loading" — callers should pass `key={ticker}`
  // so a ticker change remounts this component with a fresh loading state.
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getFinancialHealth(ticker)
      .then((health) => {
        if (cancelled) return;
        if (!health) {
          setState({ status: "unavailable" });
          return;
        }
        setState({
          status: "loaded",
          cashOnHand: formatMoney(health.cashOnHand),
          runwayLabel:
            health.runwayMonths != null
              ? `${health.runwayMonths.toFixed(1)} months`
              : "—",
          burnLabel:
            health.quarterlyBurn != null
              ? `${health.quarterlyBurn > 0 ? "+" : ""}${formatMoney(health.quarterlyBurn)}`
              : null,
          note: health.note,
          asOf: health.cashAsOf,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (state.status !== "loaded") return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Cash & runway</Text>
      <ListContainer>
        <Row label="Cash on hand" value={state.cashOnHand} />
        {state.burnLabel ? <Row label="Last quarter's burn" value={state.burnLabel} /> : null}
        <Row label="Estimated runway" value={state.runwayLabel} />
      </ListContainer>
      <Text style={styles.footnote}>
        {state.note ? `${state.note} ` : ""}
        BioLens calculated, from cash and operating cash flow reported in the company&apos;s SEC
        filings as of {state.asOf}.
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  rowLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.mono,
    fontSize: 14,
    color: colors.textPrimary,
  },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
