import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { DiscoveryCardData, FRONTIER_SCORE_EXPLANATION } from "../types/domain";
import MockDataFlag from "./MockDataFlag";

/**
 * BUILD_BRIEF.txt §54, followed field-for-field: name/ticker header,
 * Frontier Score, "Why it surfaced", "BioLens in one sentence", "Key risk",
 * [Explore]. FRONTIER_SCORE_EXPLANATION is shown every time a score is —
 * §53's rule that the score must never be presented without its own
 * "not investment attractiveness" caveat right there with it.
 */
export default function DiscoveryCard({
  data,
  onExplore,
}: {
  data: DiscoveryCardData;
  onExplore?: () => void;
}) {
  return (
    <View style={styles.card}>
      {data.isMockData ? <MockDataFlag /> : null}

      <View style={styles.headerRow}>
        <Text style={styles.name}>{data.name}</Text>
        {data.ticker ? <Text style={styles.ticker}>{data.ticker}</Text> : null}
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Frontier Score</Text>
        <Text style={styles.scoreValue}>{data.frontierScore}</Text>
      </View>
      <Text style={styles.scoreExplanation}>{FRONTIER_SCORE_EXPLANATION}</Text>

      <Section title="Why it surfaced">
        {data.whyItSurfaced.map((reason, i) => (
          <Text key={i} style={styles.bulletText}>
            {"• "}
            {reason}
          </Text>
        ))}
      </Section>

      <Section title="BioLens in one sentence">
        <Text style={styles.bodyText}>{data.oneSentenceSummary}</Text>
      </Section>

      <Section title="Key risk">
        <Text style={styles.bodyText}>{data.keyRisk}</Text>
      </Section>

      {onExplore ? (
        <Pressable style={styles.exploreButton} onPress={onExplore}>
          <Text style={styles.exploreButtonText}>Explore</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.heading,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  ticker: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginRight: spacing.sm,
  },
  scoreValue: {
    ...typography.title,
    color: colors.accent,
  },
  scoreExplanation: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  bulletText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  exploreButton: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    backgroundColor: colors.accentMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  exploreButtonText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
});
