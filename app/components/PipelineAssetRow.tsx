import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { PipelineAsset } from "../types/domain";
import WatchButton from "./WatchButton";

/**
 * BUILD_BRIEF.txt §20: one row in a company's Pipeline view. Shows exactly
 * the fields the brief specifies: drug name, target, modality, disease,
 * phase, trial IDs, next known milestone. A plain row now (meant to sit
 * inside a ListContainer with the rest of the pipeline), not its own
 * boxed card — a company with five pipeline assets used to render five
 * identical gray boxes in a row, which is exactly the repeating-block
 * pattern this whole redesign is undoing.
 *
 * Follow buttons for both the drug and its target — the target's entityId
 * is the target string itself (e.g. "PLK1"), so following it once here
 * represents following that biology broadly, not this one company's asset.
 */
export default function PipelineAssetRow({ asset }: { asset: PipelineAsset }) {
  return (
    <View style={styles.row}>
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
        {asset.nextMilestone ? (
          <Text style={styles.milestone}>Next: {asset.nextMilestone}</Text>
        ) : null}
      </View>
      <Text style={styles.stage}>{asset.stage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  stage: {
    ...typography.label,
    color: colors.accent,
    marginLeft: spacing.md,
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
    fontSize: 16,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginRight: spacing.xs,
  },
  trialIds: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  milestone: {
    ...typography.body,
    fontSize: 13,
    color: colors.accent,
    marginTop: 2,
  },
});
