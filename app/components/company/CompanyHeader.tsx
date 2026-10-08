import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, numeric, spacing, typography } from "../../constants/theme";
import { useWatchlist } from "../../context/WatchlistContext";
import { useFinancialHealth, useQuote, useValuation } from "../../hooks/useCompanyData";
import type { CompanyRecord } from "../../types/domain";
import { currencyPrefix } from "../../utils/currency";
import {
  formatDateTime,
  formatIsoDate,
  formatSignedPercent,
  formatUsdCompact,
} from "../../utils/format";
import Missing from "../ui/Missing";
import Tag from "../ui/Tag";
import { Text } from "../ui/Text";

/**
 * The dashboard's fixed header: identity, live price, and the strip of key
 * figures that stays put while the tabs below change -- so switching from
 * Financials to Pipeline never loses the company's context.
 */
export default function CompanyHeader({ company }: { company: CompanyRecord }) {
  const quote = useQuote(company.ticker);
  const valuation = useValuation(company.ticker);
  const health = useFinancialHealth(company.ticker);
  const { isWatched, toggle } = useWatchlist();
  const watched = isWatched("company", company.id);

  const q = quote?.status === "loaded" ? quote.data : null;
  const v = valuation?.status === "loaded" ? valuation.data : null;
  const h = health?.status === "loaded" ? health.data : null;
  const loading = (r: { status: string } | null) => r?.status === "loading";

  const runway =
    h?.runwayMonths != null
      ? `${h.runwayMonths.toFixed(1)} mo`
      : h?.quarterlyBurn != null && h.quarterlyBurn > 0
        ? "Cash-flow positive"
        : null;

  const stats: { label: string; value: string | null; missing?: string; pending?: boolean }[] = [
    { label: "Therapeutic area", value: company.therapeuticArea || company.primaryFocus },
    { label: "Most advanced stage", value: company.stage },
    {
      label: "Market cap",
      value: v ? formatUsdCompact(v.marketCap) : null,
      missing: company.ticker ? "Not available" : "No ticker",
      pending: loading(valuation),
    },
    {
      label: "Enterprise value",
      value: v?.enterpriseValue != null ? formatUsdCompact(v.enterpriseValue) : null,
      missing: company.ticker ? "Not available" : "No ticker",
      pending: loading(valuation),
    },
    {
      label: "Cash & investments",
      value: h ? formatUsdCompact(h.cashOnHand) : null,
      missing: company.ticker ? "Not in filings" : "No ticker",
      pending: loading(health),
    },
    {
      label: "Runway",
      value: runway,
      missing: company.ticker ? "Not computable" : "No ticker",
      pending: loading(health),
    },
    { label: "Pipeline assets", value: String(company.pipeline.length) },
  ];

  return (
    <View style={styles.header}>
      <View style={styles.identityRow}>
        <View style={styles.identity}>
          <Text style={styles.name}>{company.name}</Text>
          {company.ticker ? <Tag label={company.ticker} /> : null}
          {q?.exchange ? <Text style={styles.exchange}>{q.exchange}</Text> : null}
          {company.isMockData ? <Tag label="Illustrative profile" tone="caution" /> : null}
          {company.reviewStatus === "ai_drafted_unreviewed" ? (
            <Tag label="AI-drafted, pending review" tone="caution" />
          ) : null}
        </View>
        <Pressable
          onPress={() => toggle("company", company.id)}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.watch,
            watched && styles.watchActive,
            hovered && styles.watchHovered,
          ]}
          accessibilityLabel={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Ionicons
            name={watched ? "bookmark" : "bookmark-outline"}
            size={13}
            color={watched ? colors.accent : colors.textSecondary}
          />
          <Text style={[styles.watchText, watched && styles.watchTextActive]}>
            {watched ? "On watchlist" : "Add to watchlist"}
          </Text>
        </Pressable>
      </View>

      {q ? (
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {currencyPrefix(q.currency)}
            {q.price.toFixed(2)}
          </Text>
          <Text style={[styles.change, { color: q.change >= 0 ? colors.gain : colors.loss }]}>
            {q.change >= 0 ? "+" : ""}
            {q.change.toFixed(2)}
            {q.change_percent != null ? ` (${formatSignedPercent(q.change_percent)})` : ""}
          </Text>
          <Text style={styles.asOf}>
            {q.market_time ? `Price as of ${formatDateTime(q.market_time)}` : "Latest price"} ·
            Yahoo Finance, may be delayed
          </Text>
        </View>
      ) : null}

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.value ? (
              <Text style={styles.statValue} numberOfLines={1}>
                {stat.value}
              </Text>
            ) : stat.pending ? (
              <Text style={styles.statPending}>Loading…</Text>
            ) : (
              <Missing label={stat.missing} />
            )}
          </View>
        ))}
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Profile updated</Text>
          <Text style={styles.statValue}>{formatIsoDate(company.updatedAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
    flexShrink: 1,
  },
  name: { ...typography.title, color: colors.textPrimary },
  exchange: { ...typography.caption, color: colors.textTertiary },
  watch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
  },
  watchActive: { borderColor: colors.accentMuted, backgroundColor: colors.accentMuted },
  watchHovered: { borderColor: colors.borderStrong },
  watchText: { fontSize: 12, fontWeight: "500", color: colors.textSecondary },
  watchTextActive: { color: colors.accent },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.md, flexWrap: "wrap" },
  price: { fontSize: 22, fontWeight: "600", color: colors.textPrimary },
  change: { fontSize: 14, fontWeight: "500", ...numeric },
  asOf: { ...typography.caption, color: colors.textTertiary },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
    rowGap: spacing.sm,
  },
  stat: {
    minWidth: 120,
    paddingRight: spacing.xl,
    gap: 2,
  },
  statLabel: { ...typography.caption, color: colors.textTertiary },
  statValue: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, ...numeric },
  statPending: { fontSize: 13, color: colors.textTertiary },
});
