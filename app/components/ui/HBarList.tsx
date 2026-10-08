import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, numeric, spacing } from "../../constants/theme";
import Missing from "./Missing";
import { Text } from "./Text";

export type HBarItem = {
  key: string;
  label: string;
  /** Null draws no bar and shows `missingLabel` in its place. */
  value: number | null;
  missingLabel?: string;
  onPress?: () => void;
};

/**
 * Ranked horizontal bars with the label on the left and the exact value on
 * the right -- for comparing one measure across named items (companies,
 * stages), where long names wouldn't fit under vertical columns. One
 * series, one color; bars start at zero so lengths compare honestly.
 */
export default function HBarList({
  items,
  format,
  color = colors.chartNeutral,
}: {
  items: HBarItem[];
  format: (value: number) => string;
  color?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value ?? 0)) || 1;
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          disabled={!item.onPress}
          onPress={item.onPress}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.row,
            hovered && item.onPress ? styles.rowHovered : null,
          ]}
          accessibilityLabel={`${item.label}: ${item.value === null ? (item.missingLabel ?? "not available") : format(item.value)}`}
        >
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
          <View style={styles.track}>
            {item.value !== null && item.value > 0 ? (
              <View
                style={[
                  styles.bar,
                  { width: `${(item.value / max) * 100}%`, backgroundColor: color },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.valueWrap}>
            {item.value === null ? (
              <Missing label={item.missingLabel ?? "n/a"} />
            ) : (
              <Text style={styles.value}>{format(item.value)}</Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 26,
    borderRadius: 2,
  },
  rowHovered: { backgroundColor: colors.surfaceRaised },
  label: { width: 150, fontSize: 12, color: colors.textSecondary },
  track: { flex: 1, height: 10, justifyContent: "center" },
  bar: { height: 10, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  valueWrap: { width: 84, alignItems: "flex-end" },
  value: { fontSize: 12, fontWeight: "500", color: colors.textPrimary, ...numeric },
});
