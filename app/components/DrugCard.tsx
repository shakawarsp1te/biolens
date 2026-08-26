import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { DrugSummary } from "../types/domain";
import MockDataFlag from "./MockDataFlag";
import WatchButton from "./WatchButton";

export default function DrugCard({ drug }: { drug: DrugSummary }) {
  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {drug.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {drug.companyName} · {drug.target}
          {drug.isMockData ? <MockDataFlag /> : null}
        </Text>
        <Text style={styles.oneLiner} numberOfLines={2}>
          {drug.oneLiner}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.phase}>{drug.phase}</Text>
        <WatchButton entityType="drug" entityId={drug.id} size={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.md,
  },
  identity: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.heading,
    fontSize: 16,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 1,
  },
  oneLiner: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  phase: {
    ...typography.label,
    color: colors.accent,
  },
});
