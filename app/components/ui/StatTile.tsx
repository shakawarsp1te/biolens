import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { Text } from "./Text";

/** One headline figure with its label and a line of context. */
export default function StatTile({
  label,
  value,
  detail,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.tile,
        hovered && onPress ? styles.tileHovered : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Pressable>
  );
}

/** Tiles in a row that wraps on narrow screens. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 2,
  },
  tileHovered: { borderColor: colors.border },
  label: { ...typography.caption, fontSize: 12, color: colors.textTertiary },
  value: { fontSize: 22, fontWeight: "600", color: colors.textPrimary },
  detail: { ...typography.caption, color: colors.textTertiary },
});
