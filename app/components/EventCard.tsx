import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { EventSummary, EvidenceClassification } from "../types/domain";
import Avatar from "./Avatar";
import MockDataFlag from "./MockDataFlag";
import SourceChip from "./SourceChip";

const CLASSIFICATION_META: Record<EvidenceClassification, { label: string; color: string }> = {
  confirmatory_positive: { label: "Confirmatory positive", color: colors.evidenceConfirmatory },
  encouraging_signal: { label: "Encouraging signal", color: colors.evidenceEncouraging },
  inconclusive: { label: "Inconclusive", color: colors.evidenceInconclusive },
  negative_primary_endpoint: { label: "Negative on primary endpoint", color: colors.evidenceNegative },
};

const CONFIDENCE_LABEL: Record<EventSummary["confidence"], string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

/**
 * Home feed item. Leads with the bottom line first, per the information
 * hierarchy rule (BUILD_BRIEF.txt §65): Bottom line -> Why it matters ->
 * Data -> Sources.
 *
 * No uppercase meta line above the headline, and evidence classification +
 * confidence collapse into one plain-text line instead of two separate
 * pill badges — the headline itself is what a real feed leads with, not a
 * caption stack above it.
 */
export default function EventCard({ event }: { event: EventSummary }) {
  return (
    <View style={styles.container}>
      <View style={styles.identityRow}>
        <Avatar name={event.companyName} size={28} />
        <Text style={styles.identityText} numberOfLines={1}>
          {event.companyName}
          {event.ticker ? ` · ${event.ticker}` : ""} · {event.phase}
          {event.isMockData ? <MockDataFlag /> : null}
        </Text>
      </View>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.bottomLine}>{event.bottomLine}</Text>
      <Text style={styles.evidenceLine}>
        <Text style={{ color: CLASSIFICATION_META[event.evidenceClassification].color }}>
          {CLASSIFICATION_META[event.evidenceClassification].label}
        </Text>
        <Text style={styles.evidenceSeparator}> · {CONFIDENCE_LABEL[event.confidence]}</Text>
      </Text>
      {event.sources.length > 0 ? (
        <View style={styles.sourceRow}>
          {event.sources.map((source) => (
            <SourceChip key={source.id} source={source} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  identityText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  bottomLine: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  evidenceLine: {
    ...typography.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  evidenceSeparator: {
    color: colors.textTertiary,
    fontWeight: "500",
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
