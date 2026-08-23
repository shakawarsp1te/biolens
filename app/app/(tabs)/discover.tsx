import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import DiscoveryCard from "../../components/DiscoveryCard";
import DrugCard from "../../components/DrugCard";
import FilterPill from "../../components/FilterPill";
import ScreenShell from "../../components/ScreenShell";
import TrialMetric from "../../components/TrialMetric";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { MOCK_TRIAL_METRICS } from "../../mocks/phase1Preview";
import { DrugSummary, TrialPhase } from "../../types/domain";
import { applyDiscoverFilters } from "../../utils/discoverFilters";

// Phase 8: Discovery Card (BUILD_BRIEF.txt §54), the Frontier Score model,
// and filter logic all built and tested on the backend
// (api/app/services/frontier_score.py, discover.py). All four filters
// (Therapeutic Area, Stage, Modality, Target) are wired up here client-side
// against the live company list from CompaniesContext (GET /companies),
// using the exact same match rules as apply_discover_filters
// (utils/discoverFilters.ts) — swapping to server-side filtering later
// shouldn't change this screen's behavior.
export default function DiscoverScreen() {
  const router = useRouter();
  const { companies, isLoading, error } = useCompanies();
  const [stage, setStage] = useState<TrialPhase | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [therapeuticArea, setTherapeuticArea] = useState<string | null>(null);
  const [modality, setModality] = useState<string | null>(null);

  const stageOptions = useMemo(
    () => Array.from(new Set(companies.map((card) => card.stage))),
    [companies],
  );
  const targetOptions = useMemo(
    () => Array.from(new Set(companies.flatMap((card) => card.targets))).sort(),
    [companies],
  );
  const therapeuticAreaOptions = useMemo(
    () => Array.from(new Set(companies.map((card) => card.therapeuticArea))).sort(),
    [companies],
  );
  const modalityOptions = useMemo(
    () => Array.from(new Set(companies.flatMap((card) => card.modalities))).sort(),
    [companies],
  );

  const filteredCards = useMemo(
    () =>
      applyDiscoverFilters(companies, {
        stage: stage ?? undefined,
        target: target ?? undefined,
        therapeuticArea: therapeuticArea ?? undefined,
        modality: modality ?? undefined,
      }),
    [companies, stage, target, therapeuticArea, modality],
  );

  // Every real drug across every company's real pipeline — derived from
  // the same live data as the Companies section above, not a separate
  // hand-picked list. `phase` is cast from PipelineStage (Discovery/Phase
  // I-III/Regulatory/Approved) to TrialPhase (adds Preclinical/I-II/II-III)
  // for display only; DrugCard just renders it as text in a pill.
  const allDrugs: DrugSummary[] = useMemo(
    () =>
      companies.flatMap((company) =>
        company.pipeline.map((asset) => ({
          id: asset.drugId,
          name: asset.drugName,
          companyName: company.name,
          target: asset.target,
          modality: asset.modality,
          phase: asset.stage as TrialPhase,
          indication: asset.disease,
          oneLiner: asset.nextMilestone ? `Next: ${asset.nextMilestone}` : asset.disease,
          confidence: company.confidence,
          isMockData: company.isMockData,
        })),
      ),
    [companies],
  );

  if (isLoading) {
    return (
      <ScreenShell title="Discover" subtitle="Loading companies…">
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ScreenShell>
    );
  }

  if (error) {
    return (
      <ScreenShell title="Discover" subtitle="Couldn't load companies.">
        <Text style={styles.emptyState}>{error}</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Discover"
      subtitle="Emerging oncology companies, ranked by research activity — not investment attractiveness."
    >
      <Text style={styles.sectionLabel}>Therapeutic Area</Text>
      <View style={styles.pillRow}>
        <FilterPill
          label="All"
          selected={therapeuticArea === null}
          onPress={() => setTherapeuticArea(null)}
        />
        {therapeuticAreaOptions.map((option) => (
          <FilterPill
            key={option}
            label={option}
            selected={therapeuticArea === option}
            onPress={() => setTherapeuticArea(option)}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Stage</Text>
      <View style={styles.pillRow}>
        <FilterPill label="All" selected={stage === null} onPress={() => setStage(null)} />
        {stageOptions.map((option) => (
          <FilterPill key={option} label={option} selected={stage === option} onPress={() => setStage(option)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Modality</Text>
      <View style={styles.pillRow}>
        <FilterPill label="All" selected={modality === null} onPress={() => setModality(null)} />
        {modalityOptions.map((option) => (
          <FilterPill
            key={option}
            label={option}
            selected={modality === option}
            onPress={() => setModality(option)}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Target</Text>
      <View style={styles.pillRow}>
        <FilterPill label="All" selected={target === null} onPress={() => setTarget(null)} />
        {targetOptions.map((option) => (
          <FilterPill key={option} label={option} selected={target === option} onPress={() => setTarget(option)} />
        ))}
      </View>

      <Pressable style={styles.compareLink} onPress={() => router.push("/compare")}>
        <Text style={styles.compareLinkText}>Compare two companies ›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Companies ({filteredCards.length})</Text>
      {filteredCards.length === 0 ? (
        <Text style={styles.emptyState}>No companies match these filters.</Text>
      ) : (
        filteredCards.map((card) => (
          <DiscoveryCard key={card.id} data={card} onExplore={() => router.push(`/company/${card.id}`)} />
        ))
      )}

      <Text style={styles.sectionLabel}>Drugs ({allDrugs.length})</Text>
      {allDrugs.map((drug) => (
        <DrugCard key={drug.id} drug={drug} />
      ))}

      <Text style={styles.sectionLabel}>Trial metrics</Text>
      <View style={styles.metricsGroup}>
        {MOCK_TRIAL_METRICS.map((metric, i) => (
          <TrialMetric key={`${metric.kind}-${i}`} data={metric} />
        ))}
      </View>

      <Text style={styles.footnote}>
        All four filter rows use the same match rules as api/app/services/discover.py, mirrored
        client-side in utils/discoverFilters.ts. Therapeutic Area only has one real option today
        since every seed company is oncology-focused — it&apos;ll do more work once coverage broadens.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  sectionLabel: {
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
  emptyState: {
    ...typography.body,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  compareLink: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  compareLinkText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
  metricsGroup: {
    marginBottom: spacing.md,
  },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
