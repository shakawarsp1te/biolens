import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { ThesisMap as ThesisMapData } from "../types/domain";

/**
 * BUILD_BRIEF.txt §21: "What has to go right?" / "What could go wrong?" —
 * two short numbered lists, deliberately not prose. This teaches investors
 * how biotech uncertainty works; it does not resolve the uncertainty or
 * recommend an action.
 *
 * Two columns side by side with a vertical rule between them, not two
 * identical stacked gray boxes — the point of a thesis map is the
 * juxtaposition (this could happen, but so could that), which a shared
 * dividing line makes visible at a glance in a way two separate cards
 * don't. Both columns stay the same neutral color deliberately — this
 * isn't a green/red good-news-bad-news split, it's one uncertain thesis
 * viewed from two directions.
 */
export default function ThesisMap({ data }: { data: ThesisMapData }) {
  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <NumberedList title="What has to go right" items={data.whatHasToGoRight} />
      </View>
      <View style={styles.rule} />
      <View style={styles.column}>
        <NumberedList title="What could go wrong" items={data.whatCouldGoWrong} />
      </View>
    </View>
  );
}

function NumberedList({ title, items }: { title: string; items: string[] }) {
  return (
    <View>
      <Text style={styles.columnTitle}>{title}</Text>
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
    flexDirection: "row",
  },
  column: {
    flex: 1,
  },
  rule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  columnTitle: {
    ...typography.heading,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  index: {
    ...typography.mono,
    fontSize: 13,
    color: colors.textTertiary,
    width: 18,
  },
  itemText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    flex: 1,
  },
});
