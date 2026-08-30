import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { getCompanyCatalysts } from "../services/api";
import { CatalystEvent } from "../types/domain";
import ListContainer from "./ListContainer";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string, hasDayPrecision: boolean): string {
  const [year, month, day] = iso.split("-").map(Number);
  const monthLabel = MONTHS[month - 1];
  return hasDayPrecision ? `${monthLabel} ${day}, ${year}` : `${monthLabel} ${year}`;
}

const EVENT_TYPE_LABEL: Record<CatalystEvent["eventType"], string> = {
  primary_completion: "Primary completion",
  completion: "Full trial completion",
};

/**
 * Upcoming catalyst dates for a company's own real trials — every date
 * traces to ClinicalTrials.gov's own disclosed estimate for that specific
 * trial (api/app/services/catalysts.py), never a scraped or invented PDUFA
 * guess. Fetches independently on mount, same self-contained pattern as
 * StockQuoteCard/FinancialHealthCard; silently renders nothing while
 * loading or if the company's pipeline has no disclosed upcoming date.
 */
export default function CatalystCalendarCard({ companyId }: { companyId: string }) {
  const [events, setEvents] = useState<CatalystEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanyCatalysts(companyId)
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!events || events.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Upcoming catalysts</Text>
      <ListContainer>
        {events.map((event) => (
          <CatalystRow key={event.id} event={event} />
        ))}
      </ListContainer>
      <Text style={styles.footnote}>
        Dates are ClinicalTrials.gov&apos;s own disclosed estimate for each trial — sponsors revise
        these as trials progress, so treat them as a direction, not a fixed deadline.
      </Text>
    </View>
  );
}

function CatalystRow({ event }: { event: CatalystEvent }) {
  const isPast = event.dateType === "ACTUAL";
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.label} numberOfLines={1}>
          {EVENT_TYPE_LABEL[event.eventType]}
          {event.phase ? ` · ${event.phase}` : ""}
        </Text>
        <Text style={styles.date}>{formatDate(event.expectedDate, event.hasDayPrecision)}</Text>
      </View>
      <Text style={styles.meta}>
        {event.nctId}
        {isPast ? " · Reported" : " · Estimated"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.sm + 2,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontSize: 14.5,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  date: {
    ...typography.mono,
    fontSize: 13,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
