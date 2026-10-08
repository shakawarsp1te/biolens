import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, numeric, spacing, typography } from "../../constants/theme";
import Missing from "./Missing";
import { Text } from "./Text";

export type KeyValueRow = {
  label: string;
  /** A string renders as a right-aligned tabular figure; null renders as
   * Missing with `missingLabel`; a node renders as-is. */
  value: React.ReactNode | string | null;
  missingLabel?: string;
  /** Small print under the label: the period, the basis, a caveat. */
  detail?: string | null;
};

/** Label/value rows with hairline separators -- the "Key data" table. */
export default function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <View>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.row, i === rows.length - 1 && styles.lastRow]}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>{row.label}</Text>
            {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
          </View>
          {row.value === null || row.value === undefined ? (
            <Missing label={row.missingLabel} />
          ) : typeof row.value === "string" ? (
            <Text style={styles.value}>{row.value}</Text>
          ) : (
            row.value
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
  },
  lastRow: { borderBottomWidth: 0 },
  labelWrap: { flexShrink: 1 },
  label: { ...typography.label, fontWeight: "400", fontSize: 13, color: colors.textSecondary },
  detail: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  value: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textPrimary,
    textAlign: "right",
    ...numeric,
  },
});
