import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
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
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {brand ? (
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    marginBottom: spacing.xl,
  },
  wordmarkRow: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
