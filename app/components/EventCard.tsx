import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { EventSummary, EvidenceClassification } from "../types/domain";
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
      <Text style={styles.eyebrow}>
        {event.companyName}
        {event.ticker ? ` · ${event.ticker}` : ""} · {event.phase} · {event.eventType}
      </Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.bottomLine}>{event.bottomLine}</Text>
      <View style={styles.footerRow}>
        <View style={[styles.classificationDot, { backgroundColor: classification.color }]} />
        <Text style={styles.classificationLabel}>{classification.label}</Text>
      </View>
      <EvidenceBadge level={event.confidence} />
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
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  classificationDot: {
    width: 6,
    height: 6,
    borderRadius: radii.sm,
    marginRight: spacing.xs,
  },
  classificationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
});
