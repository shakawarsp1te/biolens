import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import FilterPill from "./FilterPill";

export interface FilterDimension {
  key: string;
  label: string;
  value: string | null;
  options: string[];
  onSelect: (value: string | null) => void;
}

/**
 * Replaces "four filter dimensions, each its own uppercase-labeled row of
 * pills stacked down the screen" with one compact horizontal bar. Tapping
 * a dimension opens a single shared options drawer beneath the bar (only
 * one open at a time) instead of every dimension's full option list
 * always being on screen whether or not it's being adjusted — closer to
 * how a real trading app's filter row behaves than to a settings-page
 * form.
 */
export default function FilterBar({ dimensions }: { dimensions: FilterDimension[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = dimensions.find((d) => d.key === openKey);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bar}
      >
        {dimensions.map((dimension) => {
          const isOpen = openKey === dimension.key;
          const isActive = dimension.value !== null;
          return (
            <Pressable
              key={dimension.key}
              style={[styles.chip, (isOpen || isActive) && styles.chipActive]}
              onPress={() => setOpenKey(isOpen ? null : dimension.key)}
            >
              <Text style={[styles.chipText, (isOpen || isActive) && styles.chipTextActive]}>
                {dimension.value ?? dimension.label}
              </Text>
              <Text style={[styles.chevron, (isOpen || isActive) && styles.chipTextActive]}>
                {isOpen ? "︿" : "﹀"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {open ? (
        <View style={styles.optionsRow}>
          <FilterPill
            label="All"
            selected={open.value === null}
            onPress={() => {
              open.onSelect(null);
              setOpenKey(null);
            }}
          />
          {open.options.map((option) => (
            <FilterPill
              key={option}
              label={option}
              selected={open.value === option}
              onPress={() => {
                open.onSelect(option);
                setOpenKey(null);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
  },
  chevron: {
    fontSize: 10,
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
});
