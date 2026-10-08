import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./ui/Text";
import { colors, spacing, typography } from "../constants/theme";
import { getFinancialHealth } from "../services/api";
import { formatMoney } from "../utils/money";
import ListContainer from "./ListContainer";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "loaded";
      cashOnHand: string;
      breakdown: string | null;
      runwayLabel: string;
      burnLabel: string | null;
      note: string | null;
      asOf: string;
    };

/**
 * Cash and marketable securities, and the runway they imply — computed deterministically from
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
          breakdown:
            health.marketableSecurities && health.cashAndEquivalents != null
              ? `${formatMoney(health.cashAndEquivalents)} cash + ${formatMoney(health.marketableSecurities)} marketable securities`
              : null,
          runwayLabel:
            health.runwayMonths != null ? `${health.runwayMonths.toFixed(1)} months` : "—",
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
        <Row label="Cash & investments" value={state.cashOnHand} detail={state.breakdown} />
        {state.burnLabel ? <Row label="Last quarter's burn" value={state.burnLabel} /> : null}
        <Row label="Estimated runway" value={state.runwayLabel} />
      </ListContainer>
      <Text style={styles.footnote}>
        {state.note ? `${state.note} ` : ""}
        BioLens calculated, from cash, marketable securities, and operating cash flow reported in
        the company&apos;s SEC filings as of {state.asOf}.
      </Text>
    </View>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
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
  rowLabelWrap: { flexShrink: 1, paddingRight: spacing.md },
  rowLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  rowDetail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
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
