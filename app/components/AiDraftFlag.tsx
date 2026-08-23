import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";

/**
 * Distinct from MockDataFlag: this means a company profile was assembled
 * by api/app/services/discovery.py's auto-discovery pipeline from real,
 * live ClinicalTrials.gov/PubMed data, with an LLM drafting only the
 * narrative fields (BioLens Summary, Why It Matters, Thesis Map) — and has
 * not yet been human-reviewed for accuracy (PLAN.md Phase 11's "manually
 * review each for accuracy before publishing" rule, enforced here instead
 * of silently skipped). A company can be both mock-data (not yet from a
 * live production Supabase deployment) and AI-drafted-unreviewed (not yet
 * human-checked) at once — the two flags mean different things and can
 * both show.
 */
export default function AiDraftFlag() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>AI-drafted — pending review</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentMuted,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.caption,
    color: colors.accent,
  },
});
