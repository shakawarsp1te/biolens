import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import CompanyCard from "../../components/CompanyCard";
import DrugCard from "../../components/DrugCard";
import ScreenShell from "../../components/ScreenShell";
import TrialMetric from "../../components/TrialMetric";
import { colors, spacing, typography } from "../../constants/theme";
import { MOCK_COMPANIES, MOCK_DRUGS, MOCK_TRIAL_METRICS } from "../../mocks/phase1Preview";

// Real Discover (Frontier Score model, filters, ~20 emerging companies) is
// Phase 8. This screen previews the Phase 1 components with mock data so
// they're visible end to end before that filtering/scoring work exists.
export default function DiscoverScreen() {
  const router = useRouter();

  return (
    <ScreenShell
      title="Discover"
      subtitle="Emerging oncology companies, ranked by research activity — not investment attractiveness."
    >
      <Text style={styles.sectionLabel}>Companies</Text>
      {MOCK_COMPANIES.map((company) => (
        <CompanyCard key={company.id} company={company} onPress={() => router.push(`/company/${company.id}`)} />
      ))}

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
        Filters (Therapeutic Area, Stage, Modality, Target) and the Frontier Score model land in Phase 8, once seed
        data (Phase 2) exists.
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
  metricsGroup: {
    marginBottom: spacing.md,
  },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
