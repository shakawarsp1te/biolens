import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { DiscoveryCardData, FRONTIER_SCORE_EXPLANATION } from "../types/domain";
import Avatar from "./Avatar";
import MockDataFlag from "./MockDataFlag";
import WatchButton from "./WatchButton";

/**
 * BUILD_BRIEF.txt §54, followed field-for-field: name/ticker header,
 * Frontier Score, "Why it surfaced", "BioLens in one sentence", "Key risk",
 * [Explore]. FRONTIER_SCORE_EXPLANATION is shown every time a score is —
 * §53's rule that the score must never be presented without its own
 * "not investment attractiveness" caveat right there with it.
 *
 * The score gets the "hero number" treatment (large, bold, top-right,
 * beside the company identity) deliberately — it's the single stat this
 * whole card exists to justify, so it should read at a glance the way a
 * price would on a trading app, while the caption right under it keeps
 * that comparison from being misleading.
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
        <View style={styles.identity}>
          <Avatar name={data.name} size={40} />
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {data.name}
            </Text>
            {data.ticker ? <Text style={styles.ticker}>{data.ticker}</Text> : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <WatchButton entityType="company" entityId={data.id} />
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>{data.frontierScore}</Text>
            <Text style={styles.scoreLabel}>Frontier Score</Text>
          </View>
        </View>
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
        <Pressable
          style={({ pressed }) => [styles.exploreButton, pressed && styles.exploreButtonPressed]}
          onPress={onExplore}
        >
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
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: spacing.md,
  },
  identityText: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  name: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  ticker: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scoreBlock: {
    alignItems: "flex-end",
  },
  scoreValue: {
    ...typography.hero,
    fontSize: 32,
    color: colors.accent,
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginTop: -2,
  },
  scoreExplanation: {
    ...typography.caption,
    color: colors.textTertiary,
    letterSpacing: 0,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
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
    marginTop: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
  },
  exploreButtonPressed: {
    opacity: 0.85,
  },
  exploreButtonText: {
    ...typography.body,
    color: "#04070D",
    fontWeight: "700",
  },
});
