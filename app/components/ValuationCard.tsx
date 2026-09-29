import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { getValuation, Valuation } from "../services/api";
import { formatMoney } from "../utils/money";
import ListContainer from "./ListContainer";

/**
 * Market cap, enterprise value, trailing revenue and R&D, and plain
 * multiples (api/app/services/valuation.py) — every number with the inputs
 * behind it, so a reader can check the arithmetic. Facts about how the
 * market prices the company; never labeled cheap, expensive or
 * "undervalued". Renders nothing when a correct figure can't be computed
 * (a foreign filer or non-USD listing), same graceful-degradation contract
 * as FinancialHealthCard.
 */
export default function ValuationCard({ ticker }: { ticker: string }) {
  const [valuation, setValuation] = useState<Valuation | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getValuation(ticker)
      .then((result) => {
        if (!cancelled) setValuation(result);
      })
      .catch(() => {
        if (!cancelled) setValuation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (!valuation) return null;
  const v = valuation;
  const shares = `${(v.sharesOutstanding / 1_000_000).toFixed(1)}M shares × $${v.sharePrice.toFixed(2)}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Valuation</Text>
      <ListContainer>
        <Row label="Market cap" value={formatMoney(v.marketCap)} detail={shares} />
        {v.enterpriseValue != null ? (
          <Row
            label="Enterprise value"
            value={formatMoney(v.enterpriseValue)}
            detail={`Market cap + ${formatMoney(v.totalDebt ?? 0)} debt − ${formatMoney(
              v.cashAndInvestments ?? 0,
            )} cash & investments`}
          />
        ) : null}
        {v.netCashToMarketCap != null ? (
          <Row
            label="Net cash vs market cap"
            value={`${Math.round(v.netCashToMarketCap * 100)}%`}
            detail={
              v.netCashToMarketCap > 1
                ? "Net cash exceeds the market cap, so enterprise value is negative"
                : "Share of the market cap covered by cash & investments minus debt"
            }
          />
        ) : null}
        {v.ttmRevenue != null ? (
          <Row
            label="Revenue (last 12 months)"
            value={formatMoney(v.ttmRevenue)}
            detail={v.ttmRevenueThrough ? `Four quarters through ${v.ttmRevenueThrough}` : null}
          />
        ) : null}
        {v.evToRevenue != null ? (
          <Row label="EV / revenue" value={`${v.evToRevenue.toFixed(1)}×`} />
        ) : null}
        {v.ttmRnD != null ? (
          <Row
            label="R&D spend (last 12 months)"
            value={formatMoney(v.ttmRnD)}
            detail={v.ttmRnDThrough ? `Four quarters through ${v.ttmRnDThrough}` : null}
          />
        ) : null}
      </ListContainer>
      <Text style={styles.footnote}>
        {v.notes.length > 0 ? `${v.notes.join(" ")} ` : ""}
        BioLens calculated, from the company&apos;s SEC filings (shares as of {v.sharesAsOf}
        {v.cashAsOf ? `, balance sheet as of ${v.cashAsOf}` : ""}) and the live share price. These
        are facts about how the market prices the company, not a judgment of whether it&apos;s cheap
        or expensive.
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
  rowLabel: { ...typography.label, color: colors.textSecondary },
  rowDetail: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  rowValue: { ...typography.mono, fontSize: 14, color: colors.textPrimary },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
