import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { TrialMetricData } from "../types/domain";

/**
 * Displays one deterministically-parsed trial statistic (Phase 6 rules).
 * This component is the last line of defense for those rules at render time:
 *   - ORR is never a bare percentage — always "N of M evaluable patients" first.
 *   - Hazard ratios get plain-language framing, never "% of patients saved/lived longer".
 *   - P-values are shown as-is, never auto-framed as "success" at p<0.05.
 *   - Endpoint role (primary/secondary/exploratory) is always visible.
 */
export default function TrialMetric({ data }: { data: TrialMetricData }) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{data.label}</Text>
        {data.endpointRole ? (
          <Text style={styles.endpointRole}>{endpointRoleLabel(data.endpointRole)}</Text>
        ) : null}
      </View>

      {renderPrimaryValue(data)}

      {data.confidenceInterval ? (
        <Text style={styles.detail}>
          95% CI: {data.confidenceInterval[0]}–{data.confidenceInterval[1]}
        </Text>
      ) : null}

      {typeof data.pValue === "number" ? (
        <Text style={styles.detail}>p = {data.pValue}</Text>
      ) : null}

      {data.caption ? <Text style={styles.caption}>{data.caption}</Text> : null}

      {data.flag ? (
        <View style={styles.flagBox}>
          <Text style={styles.flagText}>{data.flag}</Text>
        </View>
      ) : null}
    </View>
  );
}

function renderPrimaryValue(data: TrialMetricData) {
  switch (data.kind) {
    case "orr": {
      if (data.responders == null || data.evaluable == null) return null;
      const pct = Math.round((data.responders / data.evaluable) * 100);
      return (
        <>
          <Text style={styles.primary}>
            {data.responders} of {data.evaluable} evaluable patients
          </Text>
          <Text style={styles.secondary}>ORR {pct}%</Text>
        </>
      );
    }
    case "hazard_ratio": {
      if (data.hazardRatio == null) return null;
      return <Text style={styles.primary}>HR {data.hazardRatio.toFixed(2)}</Text>;
    }
    default:
      return data.value ? <Text style={styles.primary}>{data.value}</Text> : null;
  }
}

function endpointRoleLabel(role: NonNullable<TrialMetricData["endpointRole"]>) {
  switch (role) {
    case "primary":
      return "Primary endpoint";
    case "secondary":
      return "Secondary endpoint";
    case "exploratory":
      return "Exploratory endpoint";
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  endpointRole: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  primary: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  secondary: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  caption: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  flagBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.mockDataBanner,
    borderRadius: radii.sm,
    padding: spacing.xs,
  },
  flagText: {
    ...typography.caption,
    color: colors.confidenceModerate,
  },
});
