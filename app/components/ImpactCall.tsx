import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { ImpactDirection, PaperImpact, SignalOutcome } from "../types/domain";

/**
 * Direction reuses the muted gain/loss colors real price moves already use
 * (constants/theme.ts) — a call is BioLens's read on whether a paper is
 * good or bad news for the company, so it gets the same restrained
 * treatment, always paired with a written label, never color alone.
 */
export const DIRECTION_META: Record<
  ImpactDirection,
  { label: string; glyph: string; color: string }
> = {
  likely_positive: { label: "Likely positive", glyph: "↗", color: colors.gain },
  likely_negative: { label: "Likely negative", glyph: "↘", color: colors.loss },
  mixed: { label: "Mixed", glyph: "↔", color: colors.confidenceModerate },
  unlikely_to_matter: { label: "Unlikely to matter", glyph: "○", color: colors.textTertiary },
};

const CONFIDENCE_LABEL = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

export function formatReturn(value: number): string {
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** The most mature horizon available, e.g. "5 trading days". */
export function latestHorizon(outcome: SignalOutcome | null | undefined) {
  for (const [key, label] of [
    ["20d", "20 trading days"],
    ["5d", "5 trading days"],
    ["1d", "1 trading day"],
  ] as const) {
    const horizon = outcome?.horizons[key];
    if (horizon) return { horizon, label };
  }
  return null;
}

/**
 * BioLens's call on one paper, collapsed to a single direction line plus
 * headline; tapping expands the reasoning, the findings that drove it,
 * what the paper doesn't tell you, and — once enough trading days have
 * passed — what the stock actually did relative to the biotech benchmark.
 */
export default function ImpactCall({
  impact,
  outcome,
  sourceUrl,
}: {
  impact: PaperImpact;
  outcome?: SignalOutcome | null;
  sourceUrl?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const meta = DIRECTION_META[impact.direction];
  const latest = latestHorizon(outcome);

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${meta.label}, ${CONFIDENCE_LABEL[impact.confidence]}. ${impact.headline}`}
      style={styles.wrap}
    >
      <Text style={styles.directionLine}>
        <Text style={{ color: meta.color }}>
          {meta.glyph} {meta.label}
        </Text>
        <Text style={styles.confidence}> · {CONFIDENCE_LABEL[impact.confidence]}</Text>
      </Text>
      <Text style={styles.headline}>{impact.headline}</Text>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.body}>{impact.reasoning}</Text>
          {impact.keyFindings.length > 0 ? (
            <>
              <Text style={styles.subheading}>What drove the call</Text>
              {impact.keyFindings.map((finding) => (
                <Text key={finding} style={styles.bullet}>
                  • {finding}
                </Text>
              ))}
            </>
          ) : null}
          {impact.caveats.length > 0 ? (
            <>
              <Text style={styles.subheading}>What this paper doesn&apos;t tell you</Text>
              {impact.caveats.map((caveat) => (
                <Text key={caveat} style={styles.bullet}>
                  • {caveat}
                </Text>
              ))}
            </>
          ) : null}
          {latest ? (
            <>
              <Text style={styles.subheading}>What the stock did since</Text>
              <Text style={styles.body}>
                <Text style={styles.mono}>{formatReturn(latest.horizon.stockReturn)}</Text> over{" "}
                {latest.label}, vs{" "}
                <Text style={styles.mono}>{formatReturn(latest.horizon.benchmarkReturn)}</Text> for{" "}
                {outcome?.benchmark} (biotech index). Many things move a stock; one paper is rarely
                the reason.
              </Text>
            </>
          ) : null}
          {sourceUrl ? (
            <Text style={styles.link} onPress={() => Linking.openURL(sourceUrl)}>
              Read the abstract on PubMed ↗
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.more}>Why BioLens thinks so</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  directionLine: { ...typography.label },
  confidence: { ...typography.caption, color: colors.textTertiary },
  headline: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 2,
  },
  more: { ...typography.caption, color: colors.accent, marginTop: spacing.xs },
  detail: { marginTop: spacing.sm },
  subheading: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  body: { ...typography.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  bullet: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  mono: { ...typography.mono, fontSize: 13.5, color: colors.textPrimary },
  link: { ...typography.caption, color: colors.accent, marginTop: spacing.md },
});
