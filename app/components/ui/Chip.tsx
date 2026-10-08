import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radii } from "../../constants/theme";
import { Text } from "./Text";

/** A toggleable filter option. */
export default function Chip({
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
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.chip,
        hovered && styles.chipHovered,
        selected && styles.chipSelected,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 26,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  chipHovered: { borderColor: colors.borderStrong },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accentMuted },
  text: { fontSize: 12, color: colors.textSecondary },
  textSelected: { color: colors.accent, fontWeight: "500" },
});
