import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { PipelineAsset } from "../types/domain";
import WatchButton from "./WatchButton";

/**
 * BUILD_BRIEF.txt §20: one row in a company's Pipeline view. Shows exactly
 * the fields the brief specifies: drug name, target, modality, disease,
 * phase, trial IDs, next known milestone. "Clicking opens Drug Lens" per the
 * brief — Drug Lens itself is a later phase, so this is not yet tappable.
 *
 * Follow buttons for both the drug and its target — the target's entityId
 * is the target string itself (e.g. "PLK1"), so following it once here
 * represents following that biology broadly, not this one company's asset.
 */
export default function PipelineAssetRow({ asset }: { asset: PipelineAsset }) {
  return (
    <View style={styles.row}>
      <View style={styles.stagePill}>
        <Text style={styles.stageText}>{asset.stage}</Text>
      </View>
      <View style={styles.details}>
        <View style={styles.drugNameRow}>
          <Text style={styles.drugName}>{asset.drugName}</Text>
          <WatchButton entityType="drug" entityId={asset.drugId} size={16} />
        </View>
        <View style={styles.targetRow}>
          <Text style={styles.meta}>
            {asset.target} · {asset.modality}
          </Text>
          <WatchButton entityType="target" entityId={asset.target} size={14} />
        </View>
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
  drugNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  drugName: {
    ...typography.heading,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginRight: spacing.xs,
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
