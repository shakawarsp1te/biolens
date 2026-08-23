import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import FilterPill from "../components/FilterPill";
import ScreenShell from "../components/ScreenShell";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { CompanyRecord, FRONTIER_SCORE_EXPLANATION } from "../types/domain";

/**
 * Side-by-side comparison of two companies' Frontier Score, stage, and
 * thesis — a spec-table layout (not two side-by-side cards) since two full
 * DiscoveryCards don't fit legibly on a phone-width screen. Reachable from
 * Discover's "Compare companies" link. Every company from CompaniesContext
 * already carries both the Discover-card fields and the full-profile
 * fields (same underlying document — see app/models/company.py's
 * docstring), so any two companies in the list can be compared, not just
 * a hand-picked subset.
 */
export default function CompareScreen() {
  const router = useRouter();
  const { companies, isLoading } = useCompanies();
  // Explicit picks start empty; until the user taps a pill, fall back to
  // the first two loaded companies -- a derived value computed at render
  // time, not state an effect has to "correct" once the list loads.
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");
  const selectedIdA = idA || companies[0]?.id || "";
  const selectedIdB = idB || companies[1]?.id || companies[0]?.id || "";

  const companyA = useMemo(() => buildComparable(companies, selectedIdA), [companies, selectedIdA]);
  const companyB = useMemo(() => buildComparable(companies, selectedIdB), [companies, selectedIdB]);

  if (isLoading) {
    return (
      <ScreenShell title="Compare" subtitle="Loading companies…">
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Compare" subtitle="Frontier Score ranks research activity, not investment attractiveness.">
      <Text style={styles.pickerLabel}>Company A</Text>
      <View style={styles.pillRow}>
        {companies.map((company) => (
          <FilterPill
            key={company.id}
            label={company.name}
            selected={selectedIdA === company.id}
            onPress={() => setIdA(company.id)}
          />
        ))}
      </View>

      <Text style={styles.pickerLabel}>Company B</Text>
      <View style={styles.pillRow}>
        {companies.map((company) => (
          <FilterPill
            key={company.id}
            label={company.name}
            selected={selectedIdB === company.id}
            onPress={() => setIdB(company.id)}
          />
        ))}
      </View>

      {companyA && companyB ? (
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.headerCell, styles.leftCell]} numberOfLines={2}>
              {companyA.name}
            </Text>
            <Text style={styles.metricHeaderCell} />
            <Text style={[styles.headerCell, styles.rightCell]} numberOfLines={2}>
              {companyB.name}
            </Text>
          </View>

          <MetricRow
            label="Frontier Score"
            valueA={String(companyA.frontierScore)}
            valueB={String(companyB.frontierScore)}
            emphasize
          />
          <MetricRow label="Stage" valueA={companyA.stage} valueB={companyB.stage} />
          <MetricRow label="Maturity" valueA={companyA.maturity} valueB={companyB.maturity} />
          <MetricRow label="Confidence" valueA={companyA.confidence} valueB={companyB.confidence} />
          <MetricRow
            label="Pipeline assets"
            valueA={String(companyA.pipelineCount)}
            valueB={String(companyB.pipelineCount)}
          />
          <MetricRow label="Primary focus" valueA={companyA.primaryFocus} valueB={companyB.primaryFocus} />
          <MetricRow label="In one sentence" valueA={companyA.oneSentence} valueB={companyB.oneSentence} />
          <MetricRow label="Key risk" valueA={companyA.keyRisk} valueB={companyB.keyRisk} />

          <Text style={styles.footnote}>{FRONTIER_SCORE_EXPLANATION}</Text>

          <View style={styles.exploreRow}>
            <Pressable
              style={styles.exploreButton}
              onPress={() => router.push(`/company/${companyA.id}`)}
            >
              <Text style={styles.exploreButtonText}>Open {companyA.name}</Text>
            </Pressable>
            <Pressable
              style={styles.exploreButton}
              onPress={() => router.push(`/company/${companyB.id}`)}
            >
              <Text style={styles.exploreButtonText}>Open {companyB.name}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

function MetricRow({
  label,
  valueA,
  valueB,
  emphasize,
}: {
  label: string;
  valueA: string;
  valueB: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.valueCell, styles.leftCell, emphasize && styles.emphasizedValue]}>
        {valueA}
      </Text>
      <View style={styles.metricLabelWrap}>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.valueCell, styles.rightCell, emphasize && styles.emphasizedValue]}>
        {valueB}
      </Text>
    </View>
  );
}

interface Comparable {
  id: string;
  name: string;
  frontierScore: number;
  stage: string;
  maturity: string;
  confidence: string;
  pipelineCount: number;
  primaryFocus: string;
  oneSentence: string;
  keyRisk: string;
}

function buildComparable(companies: CompanyRecord[], id: string): Comparable | null {
  const company = companies.find((c) => c.id === id);
  if (!company) return null;
  return {
    id,
    name: company.name,
    frontierScore: company.frontierScore,
    stage: company.stage,
    maturity: company.maturity,
    confidence: company.confidence,
    pipelineCount: company.pipeline.length,
    primaryFocus: company.primaryFocus,
    oneSentence: company.oneSentenceSummary,
    keyRisk: company.keyRisk,
  };
}

const styles = StyleSheet.create({
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  pickerLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.sm,
  },
  table: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm + 2,
  },
  headerCell: {
    ...typography.heading,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  metricHeaderCell: {
    width: 90,
  },
  leftCell: {
    textAlign: "left",
  },
  rightCell: {
    textAlign: "right",
  },
  metricLabelWrap: {
    width: 90,
    flexGrow: 0,
    flexShrink: 0,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: "center",
  },
  valueCell: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  emphasizedValue: {
    ...typography.monoLarge,
    fontSize: 20,
    color: colors.accent,
  },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
    marginTop: spacing.md,
    textAlign: "center",
  },
  exploreRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  exploreButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  exploreButtonText: {
    ...typography.caption,
    color: "#04070D",
    fontWeight: "700",
  },
});
