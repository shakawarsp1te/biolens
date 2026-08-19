import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { ConfidenceLevel } from "../types/domain";

/**
 * Categorical confidence indicator — High / Moderate / Low only.
 * Never render a fabricated numerical probability here (BUILD_BRIEF.txt §63).
 */

const LEVEL_META: Record<ConfidenceLevel, { label: string; color: string }> = {
  high: { label: "High confidence", color: colors.confidenceHigh },
  moderate: { label: "Moderate confidence", color: colors.confidenceModerate },
  low: { label: "Low confidence", color: colors.confidenceLow },
};

export default function EvidenceBadge({
  level,
  label,
}: {
  level: ConfidenceLevel;
  /** Override the default label, e.g. "Moderate — single-arm trial". */
  label?: string;
}) {
  const meta = LEVEL_META[level];
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={styles.label}>{label ?? meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.sm,
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
