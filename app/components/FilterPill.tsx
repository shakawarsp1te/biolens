import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";

/** Robinhood-style segmented filter pill — solid accent fill when selected,
 * subtle surface fill otherwise. Used for the Discover filter row. */
export default function FilterPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  pillSelected: {
    backgroundColor: colors.accent,
  },
  pillUnselected: {
    backgroundColor: colors.surfaceRaised,
  },
  label: {
    ...typography.caption,
    letterSpacing: 0,
  },
  labelSelected: {
    color: "#04070D",
    fontWeight: "700",
  },
  labelUnselected: {
    color: colors.textSecondary,
  },
});
