import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";

/**
 * Cross-cutting rule (BUILD_BRIEF.txt, PLAN.md §3): mock/demo data must be
 * clearly flagged wherever it appears. Shared banner so every card that can
 * render mock data (CompanyCard, DrugCard, EventCard, …) flags it the same way.
 */
export default function MockDataFlag() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Mock data — not yet sourced</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "flex-start",
    backgroundColor: colors.mockDataBanner,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.caption,
    color: colors.confidenceModerate,
  },
});
