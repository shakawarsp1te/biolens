import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "../constants/theme";

/**
 * Distinct from MockDataFlag: means a company profile was assembled by
 * api/app/services/discovery.py's auto-discovery pipeline from real, live
 * ClinicalTrials.gov/PubMed data, with an LLM drafting only the narrative
 * fields -- and has not yet been human-reviewed for accuracy (PLAN.md
 * Phase 11's "manually review each for accuracy before publishing" rule).
 * Same inline-marker treatment as MockDataFlag, for the same reason: a
 * standalone repeated banner reads as templated, an inline note reads as
 * a normal product disclosure.
 */
export default function AiDraftFlag() {
  return <Text style={styles.text}> · AI-drafted, pending review</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.accent,
  },
});
