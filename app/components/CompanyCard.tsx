import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { CompanySummary } from "../types/domain";
import Avatar from "./Avatar";
import EvidenceBadge from "./EvidenceBadge";
import MockDataFlag from "./MockDataFlag";

export default function CompanyCard({
  company,
  onPress,
}: {
  company: CompanySummary;
  /** Omit to render as a static (non-tappable) card. */
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.card} onPress={onPress}>
      {company.isMockData ? <MockDataFlag /> : null}
      <View style={styles.headerRow}>
        <Avatar name={company.name} size={36} />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{company.name}</Text>
            {company.ticker ? <Text style={styles.ticker}>{company.ticker}</Text> : null}
          </View>
          <Text style={styles.meta}>
            {company.stage} · {company.therapeuticArea}
          </Text>
        </View>
      </View>
      <Text style={styles.oneLiner}>{company.oneLiner}</Text>
      <View style={styles.footerRow}>
        <EvidenceBadge level={company.confidence} />
        {typeof company.frontierScore === "number" ? (
          <Text style={styles.frontierScore}>Frontier Score {company.frontierScore}</Text>
        ) : null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  identityText: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    ...typography.heading,
    fontSize: 16,
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
    marginTop: 1,
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
