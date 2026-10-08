import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../../constants/theme";
import { useIsWideWeb } from "../../utils/layout";
import { Text } from "./Text";

/**
 * Frame for a full-width research page (screener, calendar, analysis): a
 * compact title row with optional actions, then the page's panels. Wider
 * than ScreenShell's reading column because these pages are tables.
 */
export default function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isWide = useIsWideWeb();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
    >
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: 1480,
    alignSelf: "center",
  },
  contentWide: { padding: spacing.xl, paddingTop: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  titles: { flexShrink: 1, gap: 2 },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  actions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  body: { gap: spacing.md },
});
