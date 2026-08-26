import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { TrialSearchResult } from "../services/api";

/** Renders one live ClinicalTrials.gov search result — real data straight
 * from the API, not a mock. Fields can be null (a field-limited search
 * response, or CT.gov just not having that value), so every line is
 * conditional rather than assuming completeness. A plain row, meant to
 * sit inside a ListContainer with the rest of the results. */
export default function TrialResultRow({ trial }: { trial: TrialSearchResult }) {
  return (
    <View style={styles.row}>
      <View style={styles.headerRow}>
        {trial.nct_id ? <Text style={styles.nctId}>{trial.nct_id}</Text> : null}
        {trial.phase ? <Text style={styles.phase}>{trial.phase}</Text> : null}
      </View>
      {trial.brief_title ? <Text style={styles.title}>{trial.brief_title}</Text> : null}
      <View style={styles.metaRow}>
        {trial.lead_sponsor ? (
          <Text style={styles.meta} numberOfLines={1}>
            {trial.lead_sponsor}
          </Text>
        ) : null}
        {trial.overall_status ? (
          <Text style={styles.status}>{formatStatus(trial.overall_status)}</Text>
        ) : null}
      </View>
      {trial.conditions.length > 0 ? (
        <Text style={styles.conditions} numberOfLines={2}>
          {trial.conditions.join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  nctId: {
    ...typography.mono,
    fontSize: 13,
    color: colors.accent,
  },
  phase: {
    ...typography.label,
    color: colors.textTertiary,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  status: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
  conditions: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
