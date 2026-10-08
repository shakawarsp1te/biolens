import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../constants/theme";
import { Text } from "./Text";

export type TabItem<K extends string> = { key: K; label: string };

/** Underlined tabs for switching views inside one page. Scrolls
 * horizontally when the row is wider than the screen (phones). */
export default function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const selected = tab.key === active;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onChange(tab.key)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  hovered && !selected && styles.tabHovered,
                ]}
              >
                <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row" },
  tab: {
    paddingHorizontal: spacing.md,
    height: 38,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabSelected: { borderBottomColor: colors.accent },
  tabHovered: { borderBottomColor: colors.borderStrong },
  label: { fontSize: 13, fontWeight: "500", color: colors.textSecondary },
  labelSelected: { color: colors.textPrimary },
});
