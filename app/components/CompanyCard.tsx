import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { CompanySummary } from "../types/domain";
import EvidenceBadge from "./EvidenceBadge";
import MockDataFlag from "./MockDataFlag";

export default function CompanyCard({ company }: { company: CompanySummary }) {
  return (
    <View style={styles.card}>
      {company.isMockData ? <MockDataFlag /> : null}
      <View style={styles.headerRow}>
        <Text style={styles.name}>{company.name}</Text>
        {company.ticker ? <Text style={styles.ticker}>{company.ticker}</Text> : null}
      </View>
      <Text style={styles.meta}>
        {company.stage} · {company.therapeuticArea}
      </Text>
      <Text style={styles.oneLiner}>{company.oneLiner}</Text>
      <View style={styles.footerRow}>
        <EvidenceBadge level={company.confidence} />
        {typeof company.frontierScore === "number" ? (
          <Text style={styles.frontierScore}>Frontier Score {company.frontierScore}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.heading,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  // Reference only — never paired with buy/sell language or a price target.
  ticker: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  oneLiner: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  frontierScore: {
    ...typography.caption,
    color: colors.accent,
  },
});
