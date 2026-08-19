import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { DrugSummary } from "../types/domain";
import EvidenceBadge from "./EvidenceBadge";
import MockDataFlag from "./MockDataFlag";

export default function DrugCard({ drug }: { drug: DrugSummary }) {
  return (
    <View style={styles.card}>
      {drug.isMockData ? <MockDataFlag /> : null}
      <View style={styles.headerRow}>
        <Text style={styles.name}>{drug.name}</Text>
        <View style={styles.phasePill}>
          <Text style={styles.phaseText}>{drug.phase}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{drug.companyName}</Text>
      <Text style={styles.meta}>
        Target: {drug.target} · {drug.modality}
      </Text>
      <Text style={styles.meta}>Indication: {drug.indication}</Text>
      <Text style={styles.oneLiner}>{drug.oneLiner}</Text>
      <EvidenceBadge level={drug.confidence} />
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
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.heading,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  phasePill: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.sm,
  },
  phaseText: {
    ...typography.caption,
    color: colors.accent,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  oneLiner: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
