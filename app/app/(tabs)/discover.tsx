import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import DiscoveryCard from "../../components/DiscoveryCard";
import DrugCard from "../../components/DrugCard";
import FilterPill from "../../components/FilterPill";
import ScreenShell from "../../components/ScreenShell";
import TrialMetric from "../../components/TrialMetric";
import { colors, spacing, typography } from "../../constants/theme";
import { MOCK_DISCOVERY_CARDS } from "../../mocks/discoveryCards";
import { MOCK_DRUGS, MOCK_TRIAL_METRICS } from "../../mocks/phase1Preview";
import { TrialPhase } from "../../types/domain";
import { applyDiscoverFilters } from "../../utils/discoverFilters";

// Phase 8: Discovery Card (BUILD_BRIEF.txt §54), the Frontier Score model,
// and filter logic all built and tested on the backend
// (api/app/services/frontier_score.py, discover.py). Stage and Target
// filters are wired up here client-side against mock data, using the exact
// same match rules as apply_discover_filters (utils/discoverFilters.ts) —
// swapping in a real API call later shouldn't change this screen's behavior.
export default function DiscoverScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<TrialPhase | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const stageOptions = useMemo(
    () => Array.from(new Set(MOCK_DISCOVERY_CARDS.map((card) => card.stage))),
    [],
  );
  const targetOptions = useMemo(
    () => Array.from(new Set(MOCK_DISCOVERY_CARDS.flatMap((card) => card.targets))).sort(),
    [],
  );

  const filteredCards = useMemo(
    () =>
      applyDiscoverFilters(MOCK_DISCOVERY_CARDS, {
        stage: stage ?? undefined,
        target: target ?? undefined,
      }),
    [stage, target],
  );

  return (
    <ScreenShell
      title="Discover"
      subtitle="Emerging oncology companies, ranked by research activity — not investment attractiveness."
    >
      <Text style={styles.sectionLabel}>Stage</Text>
      <View style={styles.pillRow}>
        <FilterPill label="All" selected={stage === null} onPress={() => setStage(null)} />
        {stageOptions.map((option) => (
          <FilterPill key={option} label={option} selected={stage === option} onPress={() => setStage(option)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Target</Text>
      <View style={styles.pillRow}>
        <FilterPill label="All" selected={target === null} onPress={() => setTarget(null)} />
        {targetOptions.map((option) => (
          <FilterPill key={option} label={option} selected={target === option} onPress={() => setTarget(option)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Companies</Text>
      {filteredCards.length === 0 ? (
        <Text style={styles.emptyState}>No companies match these filters.</Text>
      ) : (
        filteredCards.map((card) => (
          <DiscoveryCard key={card.id} data={card} onExplore={() => router.push(`/company/${card.id}`)} />
        ))
      )}

      <Text style={styles.sectionLabel}>Drugs</Text>
      {MOCK_DRUGS.map((drug) => (
        <DrugCard key={drug.id} drug={drug} />
      ))}

      <Text style={styles.sectionLabel}>Trial metrics</Text>
      <View style={styles.metricsGroup}>
        {MOCK_TRIAL_METRICS.map((metric, i) => (
          <TrialMetric key={`${metric.kind}-${i}`} data={metric} />
        ))}
      </View>

      <Text style={styles.footnote}>
        Therapeutic Area and Modality filters exist in the same backend logic (api/app/services/discover.py)
        but are not surfaced here yet — Stage and Target are wired up as the first two to prove the pattern.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
  metricsGroup: {
    marginBottom: spacing.md,
  },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
