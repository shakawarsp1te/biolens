import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, typography } from "../../constants/theme";
import { Text } from "./Text";

// Five development stages, in order. A phase fills every segment up to and
// including its own -- a position on the path, nothing more. Every filled
// segment is the same neutral tone: a later phase is not drawn "better"
// (no green for approved), because phase alone says nothing about a drug's
// odds of success.
const STEPS = ["Preclinical", "Phase I", "Phase II", "Phase III", "Filed / approved"];

const STEP_BY_PHASE: Record<string, number> = {
  discovery: 1,
  preclinical: 1,
  "phase i": 2,
  "phase 1": 2,
  "early phase 1": 2,
  "phase i/ii": 2.5,
  "phase 1/phase 2": 2.5,
  "phase ii": 3,
  "phase 2": 3,
  "phase ii/iii": 3.5,
  "phase 2/phase 3": 3.5,
  "phase iii": 4,
  "phase 3": 4,
  regulatory: 5,
  approved: 5,
  "phase 4": 5,
};

/** Ordinal rank of a phase label (1-5, halves for combined phases), or
 * null when the label isn't a recognized phase. Used for sorting too. */
export function phaseRank(phase: string | null | undefined): number | null {
  if (!phase) return null;
  return STEP_BY_PHASE[phase.trim().toLowerCase()] ?? null;
}

export default function PhaseIndicator({
  phase,
  showLabel = true,
}: {
  phase: string;
  showLabel?: boolean;
}) {
  const rank = phaseRank(phase);
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Development stage: ${phase}`}>
      <View style={styles.track}>
        {STEPS.map((step, i) => {
          const position = i + 1;
          const fill = rank === null ? 0 : rank >= position ? 1 : rank >= position - 0.5 ? 0.5 : 0;
          return (
            <View key={step} style={styles.segment}>
              {fill > 0 ? <View style={[styles.fill, { width: `${fill * 100}%` }]} /> : null}
            </View>
          );
        })}
      </View>
      {showLabel ? <Text style={styles.label}>{phase}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { flexDirection: "row", gap: 2 },
  segment: {
    width: 14,
    height: 6,
    backgroundColor: colors.borderSubtle,
    borderRadius: 1,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.chartNeutral },
  label: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
});
