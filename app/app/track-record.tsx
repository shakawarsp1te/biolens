import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DIRECTION_META, formatReturn } from "../components/ImpactCall";
import ListContainer from "../components/ListContainer";
import ScreenShell from "../components/ScreenShell";
import SignalRow from "../components/SignalRow";
import { colors, spacing, typography } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { getTrackRecord } from "../services/api";
import { ImpactDirection, TrackRecord, TrackRecordHorizon } from "../types/domain";

// Below this many scored calls a hit rate is mostly noise; the screen says
// so instead of letting "3 of 4" read like a real accuracy figure.
const MIN_MEANINGFUL_SAMPLE = 20;

const HORIZON_LABELS = [
  ["1d", "After 1 trading day"],
  ["5d", "After 5 trading days"],
  ["20d", "After 20 trading days"],
] as const;

const DIRECTION_ORDER: ImpactDirection[] = [
  "likely_positive",
  "likely_negative",
  "mixed",
  "unlikely_to_matter",
];

/**
 * How BioLens's paper calls actually held up (api/app/services/
 * signal_outcomes.py). Every call is listed, misses included, with the
 * sample size next to every rate — a claimed correlation between papers
 * and stock moves is something this screen measures in the open, not
 * something the app asserts.
 */
export default function TrackRecordScreen() {
  const { getById } = useCompanies();
  const [record, setRecord] = useState<TrackRecord | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTrackRecord()
      .then((result) => {
        if (!cancelled) setRecord(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = "How BioLens's calls on new papers compared with what the stock did next.";

  if (failed) {
    return (
      <ScreenShell title="Track record" subtitle={subtitle}>
        <Text style={styles.body}>The track record couldn&apos;t be loaded right now.</Text>
      </ScreenShell>
    );
  }
  if (!record) {
    return (
      <ScreenShell title="Track record" subtitle={subtitle}>
        <ActivityIndicator color={colors.accent} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Track record" subtitle={subtitle}>
      <Text style={styles.body}>
        <Text style={styles.strong}>{record.totalCalls} calls so far: </Text>
        {DIRECTION_ORDER.filter((d) => record.callsByDirection[d])
          .map((d) => `${record.callsByDirection[d]} ${DIRECTION_META[d].label.toLowerCase()}`)
          .join(", ")}
        .
      </Text>

      <Text style={styles.sectionTitle}>Did the direction hold up?</Text>
      <ListContainer>
        {HORIZON_LABELS.map(([key, label]) => (
          <HorizonRow key={key} label={label} horizon={record.horizons[key]} />
        ))}
      </ListContainer>

      <Text style={styles.sectionTitle}>How it&apos;s measured</Text>
      <Text style={styles.body}>
        Each paper&apos;s baseline is the first closing price a BioLens reader could have seen the
        call at. BioLens then compares the stock&apos;s move with the {record.benchmark} biotech
        index over the same days, so a sector-wide swing isn&apos;t counted as the paper&apos;s
        effect. A &quot;likely positive&quot; call counts as right when the stock beat{" "}
        {record.benchmark}, and &quot;likely negative&quot; when it lagged. Mixed and
        unlikely-to-matter calls aren&apos;t scored either way. Companies without a public stock
        aren&apos;t scored.
      </Text>
      <Text style={styles.footnote}>
        Past calls don&apos;t predict future ones. Stocks move for many reasons, and a single paper
        is rarely the main one. This is general research commentary, not investment advice.
      </Text>

      <Text style={styles.sectionTitle}>Every call</Text>
      <ListContainer>
        {[...record.calls].reverse().map((signal) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            companyName={getById(signal.companyId)?.name}
          />
        ))}
      </ListContainer>
    </ScreenShell>
  );
}

function HorizonRow({ label, horizon }: { label: string; horizon: TrackRecordHorizon }) {
  const moves = horizon.avgAbsAbnormalReturnByDirection;
  const counts = horizon.scoredCountByDirection ?? {};
  const quiet = moves.unlikely_to_matter;
  const quietCount = counts.unlikely_to_matter ?? 0;
  // Pooled average absolute move across both directional call types,
  // weighted by how many calls each is based on.
  const directionalCount = (counts.likely_positive ?? 0) + (counts.likely_negative ?? 0);
  const directionalAvg =
    directionalCount > 0
      ? ((moves.likely_positive ?? 0) * (counts.likely_positive ?? 0) +
          (moves.likely_negative ?? 0) * (counts.likely_negative ?? 0)) /
        directionalCount
      : 0;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {horizon.directionalCallsScored === 0 ? (
        <Text style={styles.rowBody}>No directional calls old enough to score yet.</Text>
      ) : (
        <Text style={styles.rowBody}>
          Right on{" "}
          <Text style={styles.mono}>
            {horizon.hits} of {horizon.directionalCallsScored}
          </Text>{" "}
          positive/negative calls
          {horizon.hitRate !== null ? (
            <Text style={styles.mono}> ({Math.round(horizon.hitRate * 100)}%)</Text>
          ) : null}
          .
          {horizon.directionalCallsScored < MIN_MEANINGFUL_SAMPLE
            ? " Too few calls to judge yet: at this sample size, a hit rate is mostly chance."
            : ""}
        </Text>
      )}
      {quiet !== undefined ? (
        <Text style={styles.rowMeta}>
          Average move vs the index after &quot;unlikely to matter&quot; papers:{" "}
          <Text style={styles.mono}>{formatReturn(quiet).slice(1)}</Text> ({pluralCalls(quietCount)}
          )
          {directionalCount > 0 ? (
            <>
              ; after positive/negative calls:{" "}
              <Text style={styles.mono}>{formatReturn(directionalAvg).slice(1)}</Text> (
              {pluralCalls(directionalCount)})
            </>
          ) : null}
          .
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  body: { ...typography.body, color: colors.textSecondary },
  strong: { color: colors.textPrimary, fontWeight: "600" },
  footnote: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  row: { paddingVertical: spacing.sm + 2 },
  rowLabel: { ...typography.label, color: colors.textPrimary },
  rowBody: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },
  mono: { ...typography.mono, fontSize: 13.5, color: colors.textPrimary },
});

function pluralCalls(n: number): string {
  return `${n} ${n === 1 ? "call" : "calls"}`;
}
