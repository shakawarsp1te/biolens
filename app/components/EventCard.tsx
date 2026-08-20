import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { EventSummary, EvidenceClassification } from "../types/domain";
import Avatar from "./Avatar";
import EvidenceBadge from "./EvidenceBadge";
import MockDataFlag from "./MockDataFlag";
import SourceChip from "./SourceChip";

const CLASSIFICATION_META: Record<EvidenceClassification, { label: string; color: string }> = {
  confirmatory_positive: { label: "Confirmatory positive", color: colors.evidenceConfirmatory },
  encouraging_signal: { label: "Encouraging signal", color: colors.evidenceEncouraging },
  inconclusive: { label: "Inconclusive", color: colors.evidenceInconclusive },
  negative_primary_endpoint: { label: "Negative on primary endpoint", color: colors.evidenceNegative },
};

/**
 * Home feed item. Leads with the bottom line first, per the information
 * hierarchy rule (BUILD_BRIEF.txt §65): Bottom line -> Why it matters -> Data
 * -> Sources. This card covers the first and last of those; a full readout's
 * Data/Biology/Competition sections live on the company/event detail page
 * (later phase), not here.
 */
export default function EventCard({ event }: { event: EventSummary }) {
  const classification = CLASSIFICATION_META[event.evidenceClassification];
  return (
    <View style={styles.card}>
      {event.isMockData ? <MockDataFlag /> : null}
      <View style={styles.headerRow}>
        <Avatar name={event.companyName} size={32} />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {event.companyName}
          {event.ticker ? ` · ${event.ticker}` : ""} · {event.phase} · {event.eventType}
        </Text>
      </View>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.bottomLine}>{event.bottomLine}</Text>
      <View style={styles.footerRow}>
        <View style={[styles.classificationPill, { backgroundColor: classification.color + "1A" }]}>
          <Text style={[styles.classificationLabel, { color: classification.color }]}>
            {classification.label}
          </Text>
        </View>
        <EvidenceBadge level={event.confidence} />
      </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
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
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  classificationPill: {
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  classificationLabel: {
    ...typography.caption,
    letterSpacing: 0.2,
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
});
