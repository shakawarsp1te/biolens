import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, spacing, typography } from "../constants/theme";
import { CompanyRecord } from "../types/domain";
import AiDraftFlag from "./AiDraftFlag";
import Avatar from "./Avatar";
import MockDataFlag from "./MockDataFlag";
import WatchButton from "./WatchButton";

/**
 * A row in a list of companies (Discover, Watchlist) — not a repeated
 * boxed card. Real fintech watchlists are scannable: name, one line of
 * context, one big trailing number; the fuller picture (Why It Surfaced,
 * Key Risk, the whole Frontier Score breakdown) lives on the company
 * profile page now, reachable by tapping the row, rather than being
 * printed in full on every single row of the list it appears in.
 */
export default function DiscoveryCard({
  data,
  onExplore,
  newActivityCount,
}: {
  data: CompanyRecord;
  onExplore?: () => void;
  /** Real count of ClinicalTrials.gov results for this company not seen on
   * a previous visit (Watchlist screen only — see
   * utils/watchlistFreshness.ts). Omitted everywhere else. */
  newActivityCount?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onExplore}
    >
      <Avatar name={data.name} size={40} />
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {data.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {data.ticker ? `${data.ticker} · ` : ""}
          {data.stage}
          {data.isMockData ? <MockDataFlag /> : null}
          {data.reviewStatus === "ai_drafted_unreviewed" ? <AiDraftFlag /> : null}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {data.oneSentenceSummary}
        </Text>
        {newActivityCount ? (
          <Text style={styles.newActivity}>
            {newActivityCount} new trial{newActivityCount === 1 ? "" : "s"} since your last visit
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        <WatchButton entityType="company" entityId={data.id} size={18} />
        <Text style={styles.score}>{data.frontierScore}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  identity: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.heading,
    fontSize: 16,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 1,
  },
  summary: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  newActivity: {
    ...typography.body,
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
    marginTop: spacing.xs,
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  score: {
    fontSize: 22,
    fontFamily: fontFamily.monoBold,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
});
