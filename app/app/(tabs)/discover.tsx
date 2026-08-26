import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import DiscoveryCard from "../../components/DiscoveryCard";
import DrugCard from "../../components/DrugCard";
import FilterBar from "../../components/FilterBar";
import ListContainer from "../../components/ListContainer";
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
  // for display only; DrugCard just renders it as text.
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
      <FilterBar
        dimensions={[
          {
            key: "area",
            label: "Area",
            value: therapeuticArea,
            options: therapeuticAreaOptions,
            onSelect: setTherapeuticArea,
          },
          {
            key: "stage",
            label: "Stage",
            value: stage,
            options: stageOptions,
            onSelect: (value) => setStage(value as TrialPhase | null),
          },
          {
            key: "modality",
            label: "Modality",
            value: modality,
            options: modalityOptions,
            onSelect: setModality,
          },
          {
            key: "target",
            label: "Target",
            value: target,
            options: targetOptions,
            onSelect: setTarget,
          },
        ]}
      />

      <Pressable style={styles.compareLink} onPress={() => router.push("/compare")}>
        <Text style={styles.compareLinkText}>Compare two companies ›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Companies</Text>
      {filteredCards.length === 0 ? (
        <Text style={styles.emptyState}>No companies match these filters.</Text>
      ) : (
        <ListContainer>
          {filteredCards.map((card) => (
            <DiscoveryCard key={card.id} data={card} onExplore={() => router.push(`/company/${card.id}`)} />
          ))}
        </ListContainer>
      )}

      <Text style={styles.sectionTitle}>Drugs</Text>
      <ListContainer>
        {allDrugs.map((drug) => (
          <DrugCard key={drug.id} drug={drug} />
        ))}
      </ListContainer>

      <Text style={styles.sectionTitle}>Trial data</Text>
      <ListContainer>
        {MOCK_TRIAL_METRICS.map((metric, i) => (
          <TrialMetric key={`${metric.kind}-${i}`} data={metric} />
        ))}
      </ListContainer>

      <Text style={styles.footnote}>
        Therapeutic Area only has one real option today since every seed company is
        oncology-focused — it&apos;ll do more work once coverage broadens.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyState: {
    ...typography.body,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  compareLink: {
    marginTop: spacing.md,
  },
  compareLinkText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
});
