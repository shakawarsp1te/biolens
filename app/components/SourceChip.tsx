import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { Source, sourceTypeLabels } from "../types/domain";

/**
 * Small citation chip — rendered under any claim that traces to a source
 * (BUILD_BRIEF.txt §62: "Source" under important statements). Every
 * generated numeric claim must be traceable to one of these, or to
 * "BioLens calculated" (also a SourceChip, via the biolens_calculated type).
 */
export default function SourceChip({ source, onPress }: { source: Source; onPress?: () => void }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.chip} onPress={onPress}>
      <Text style={styles.type}>{sourceTypeLabels[source.type]}</Text>
      <Text style={styles.label}>{source.label}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  type: {
    ...typography.caption,
    color: colors.textTertiary,
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
});
