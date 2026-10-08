import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./ui/Text";
import { colors, spacing, typography } from "../constants/theme";
import { useIsWideWeb } from "../utils/layout";
import Wordmark from "./Wordmark";

type Props = {
  title: string;
  subtitle?: string;
  /** Shows the BioLens wordmark above the title — reserved for the app's
   * front door (the Home/"Frontier" feed) so it reads as a real product's
   * one deliberate brand moment, not a logo repeated on every single tab. */
  brand?: boolean;
  children?: React.ReactNode;
};

/**
 * Shared shell for the 5 tab screens during Phase 0 (static mock screens,
 * no live data, no AI calls yet). Each tab screen wraps its content in this
 * so the app already feels navigable before any backend integration exists.
 */
export default function ScreenShell({ title, subtitle, brand, children }: Props) {
  // On desktop the sidebar already carries the wordmark — showing it again
  // above the page title would just repeat it side by side.
  const isWide = useIsWideWeb();
  const showWordmark = brand && !isWide;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
      >
        <View style={styles.header}>
          {showWordmark ? (
            <View style={styles.wordmarkRow}>
              <Wordmark size="sm" />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A reading column: these pages are mostly prose and lists, which get
  // hard to read past ~960px. Research tables use components/ui/Page.
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
  },
  scrollContentWide: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
    gap: 2,
  },
  wordmarkRow: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
