import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { Text, TextInput } from "./Text";

/** A row of table controls: search, filters, column options. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <View style={styles.toolbar}>{children}</View>;
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={13} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close" size={13} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type SelectOption = { value: string; label: string };

/** Compact dropdown: "Stage: All ▾". Null means no filter. */
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "All";
  return (
    <View style={styles.selectWrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.select, value !== null && styles.selectActive]}
        accessibilityLabel={`${label}: ${current}`}
      >
        <Text style={styles.selectLabel}>{label}:</Text>
        <Text
          style={[styles.selectValue, value !== null && styles.selectValueActive]}
          numberOfLines={1}
        >
          {current}
        </Text>
        <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {[{ value: "__all__", label: "All" }, ...options].map((option) => {
            const selected = option.value === "__all__" ? value === null : option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value === "__all__" ? null : option.value);
                  setOpen(false);
                }}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.menuItem,
                  hovered && styles.menuItemHovered,
                ]}
              >
                <Text
                  style={[styles.menuText, selected && styles.menuTextSelected]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={13} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** "Columns" menu: checkboxes for which table columns are visible. */
export function ColumnMenu({
  columns,
  visible,
  onToggle,
}: {
  columns: { key: string; title: string; required?: boolean }[];
  visible: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.selectWrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.select}
        accessibilityLabel="Choose columns"
      >
        <Ionicons name="options-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.selectValue}>Columns</Text>
      </Pressable>
      {open ? (
        <View style={[styles.menu, styles.menuRight]}>
          {columns.map((column) => {
            const on = visible.has(column.key);
            return (
              <Pressable
                key={column.key}
                disabled={column.required}
                onPress={() => onToggle(column.key)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.menuItem,
                  hovered && styles.menuItemHovered,
                ]}
              >
                <Ionicons
                  name={on ? "checkbox" : "square-outline"}
                  size={14}
                  color={
                    column.required ? colors.textTertiary : on ? colors.accent : colors.textTertiary
                  }
                />
                <Text style={styles.menuText}>{column.title}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    zIndex: 5,
  },
  search: {
    flexGrow: 1,
    minWidth: 220,
    maxWidth: 340,
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: "none" } as object,
  selectWrap: { zIndex: 5 },
  select: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    maxWidth: 260,
  },
  selectActive: { borderColor: colors.accent },
  selectLabel: { ...typography.caption, fontSize: 12, color: colors.textTertiary },
  selectValue: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  selectValueActive: { color: colors.textPrimary, fontWeight: "500" },
  menu: {
    position: "absolute",
    top: 34,
    left: 0,
    minWidth: 200,
    maxHeight: 320,
    overflow: "scroll",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 4,
    zIndex: 20,
  },
  menuRight: { left: undefined, right: 0 },
  menuItem: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  menuItemHovered: { backgroundColor: colors.surfaceRaised },
  menuText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  menuTextSelected: { color: colors.textPrimary, fontWeight: "500" },
});
