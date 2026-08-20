import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { PipelineAsset } from "../types/domain";

/**
 * BUILD_BRIEF.txt §20: one row in a company's Pipeline view. Shows exactly
 * the fields the brief specifies: drug name, target, modality, disease,
 * phase, trial IDs, next known milestone. "Clicking opens Drug Lens" per the
 * brief — Drug Lens itself is a later phase, so this is not yet tappable.
 */
export default function PipelineAssetRow({ asset }: { asset: PipelineAsset }) {
  return (
    <View style={styles.row}>
      <View style={styles.stagePill}>
        <Text style={styles.stageText}>{asset.stage}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.drugName}>{asset.drugName}</Text>
        <Text style={styles.meta}>
          {asset.target} · {asset.modality}
        </Text>
        <Text style={styles.meta}>{asset.disease}</Text>
        {asset.trialIds.length > 0 ? (
          <Text style={styles.trialIds}>{asset.trialIds.join(", ")}</Text>
        ) : null}
        {asset.nextMilestone ? <Text style={styles.milestone}>Next: {asset.nextMilestone}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stagePill: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
    marginRight: spacing.md,
  },
  stageText: {
    ...typography.caption,
    color: colors.accent,
  },
  details: {
    flex: 1,
  },
  drugName: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  trialIds: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  milestone: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
});
