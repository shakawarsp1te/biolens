import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, numeric, spacing, typography } from "../../constants/theme";
import { Text } from "./Text";

export type Column<T> = {
  key: string;
  title: string;
  /** Fixed width in px. Columns without one share the leftover space. */
  width?: number;
  /** Flex weight for columns without a fixed width (default 1). */
  flex?: number;
  /** Numbers right-align so their digits line up. */
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Makes the column sortable. Null sorts last in both directions -- a
   * missing value is never ranked as if it were zero. */
  sortValue?: (row: T) => string | number | null;
};

type Sort = { key: string; direction: "asc" | "desc" };

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  initialSort?: Sort;
  /** Below this width the table scrolls sideways instead of squeezing. */
  minWidth?: number;
  emptyText?: string;
  /** Rendered under a row when `isExpanded` says so (detail drawers). */
  renderExpanded?: (row: T) => React.ReactNode;
  isExpanded?: (row: T) => boolean;
};

/** Compact, sortable data table -- the screener/pipeline grid. Header
 * clicks cycle a sortable column through descending and ascending. */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  initialSort,
  minWidth = 640,
  emptyText = "No rows match.",
  renderExpanded,
  isExpanded,
}: Props<T>) {
  const [sort, setSort] = useState<Sort | undefined>(initialSort);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!sort || !column?.sortValue) return rows;
    const get = column.sortValue;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sort]);

  function toggleSort(column: Column<T>) {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key: column.key, direction: column.align === "right" ? "desc" : "asc" },
    );
  }

  const cellStyle = (column: Column<T>) => [
    styles.cell,
    column.width ? { width: column.width } : { flex: column.flex ?? 1 },
    column.align === "right" && styles.cellRight,
  ];

  return (
    <ScrollView horizontal contentContainerStyle={styles.scrollContent}>
      <View style={[styles.table, { minWidth }]}>
        <View style={styles.headerRow} accessibilityRole="header">
          {columns.map((column) => {
            const active = sort?.key === column.key;
            return (
              <Pressable
                key={column.key}
                disabled={!column.sortValue}
                onPress={() => toggleSort(column)}
                style={[cellStyle(column), styles.headerCell]}
                accessibilityLabel={column.sortValue ? `Sort by ${column.title}` : column.title}
              >
                <Text
                  style={[styles.headerText, active && styles.headerTextActive]}
                  numberOfLines={1}
                >
                  {column.title}
                </Text>
                {active ? (
                  <Ionicons
                    name={sort?.direction === "asc" ? "caret-up" : "caret-down"}
                    size={10}
                    color={colors.textPrimary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          sorted.map((row) => {
            const expanded = isExpanded?.(row) ?? false;
            return (
              <View key={rowKey(row)} style={styles.rowWrap}>
                <Pressable
                  disabled={!onRowPress}
                  onPress={() => onRowPress?.(row)}
                  style={({ hovered }: { hovered?: boolean }) => [
                    styles.row,
                    (hovered || expanded) && onRowPress ? styles.rowHovered : null,
                  ]}
                >
                  {columns.map((column) => (
                    <View key={column.key} style={cellStyle(column)}>
                      {column.render(row)}
                    </View>
                  ))}
                </Pressable>
                {expanded && renderExpanded ? (
                  <View style={styles.expanded}>{renderExpanded(row)}</View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

/** Standard cell text: primary for the identifying column, secondary for
 * the rest; `numeric` cells get tabular figures. */
export function Cell({
  children,
  strong,
  numeric: isNumeric,
  muted,
  numberOfLines = 1,
}: {
  children: React.ReactNode;
  strong?: boolean;
  numeric?: boolean;
  muted?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.cellText,
        strong && styles.cellStrong,
        isNumeric && styles.cellNumeric,
        muted && styles.cellMuted,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  table: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCell: { flexDirection: "row", alignItems: "center", gap: 3, height: 32 },
  headerText: { ...typography.caption, fontWeight: "500", color: colors.textTertiary },
  headerTextActive: { color: colors.textPrimary },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  row: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  rowHovered: { backgroundColor: colors.surfaceRaised },
  cell: { paddingHorizontal: spacing.md, paddingVertical: 6, justifyContent: "center" },
  cellRight: { alignItems: "flex-end", justifyContent: "flex-end" },
  cellText: { fontSize: 13, color: colors.textSecondary },
  cellStrong: { color: colors.textPrimary, fontWeight: "500" },
  cellNumeric: { color: colors.textPrimary, textAlign: "right", ...numeric },
  cellMuted: { color: colors.textTertiary },
  expanded: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  empty: {
    ...typography.body,
    color: colors.textTertiary,
    padding: spacing.lg,
  },
});
