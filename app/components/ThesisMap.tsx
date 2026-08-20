import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { ThesisMap as ThesisMapData } from "../types/domain";

/**
 * BUILD_BRIEF.txt §21: "What has to go right?" / "What could go wrong?" —
 * two short numbered lists, deliberately not prose. This teaches investors
 * how biotech uncertainty works; it does not resolve the uncertainty or
 * recommend an action.
 */
export default function ThesisMap({ data }: { data: ThesisMapData }) {
  return (
    <View style={styles.container}>
      <NumberedSection title="What has to go right?" items={data.whatHasToGoRight} />
      <NumberedSection title="What could go wrong?" items={data.whatCouldGoWrong} />
    </View>
  );
}

function NumberedSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.index}>{i + 1}</Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  index: {
    ...typography.caption,
    color: colors.accent,
    width: 20,
  },
  itemText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
});
