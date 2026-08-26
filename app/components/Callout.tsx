import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

/**
 * A one-off notice/warning/error block — a left-border accent rule, not a
 * filled tinted box. Matches the "Key risk" treatment on the company
 * profile page (app/company/[id].tsx) rather than the flat colored
 * background used everywhere before the redesign, which read as the same
 * "Honda Tan" notice-box pattern regardless of what it was announcing.
 */
export default function Callout({
  tone = "notice",
  children,
}: {
  tone?: "notice" | "warning" | "error";
  children: React.ReactNode;
}) {
  const lineColor =
    tone === "error" ? colors.loss : tone === "warning" ? colors.confidenceModerate : colors.accent;
  return (
    <View style={[styles.block, { borderLeftColor: lineColor }]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
    marginTop: spacing.md,
  },
  text: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
