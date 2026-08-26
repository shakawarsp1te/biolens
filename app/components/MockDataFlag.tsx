import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "../constants/theme";

/**
 * Cross-cutting rule (BUILD_BRIEF.txt, PLAN.md §3): mock/demo data must be
 * clearly flagged wherever it appears. Same compliance requirement as
 * before this redesign, different presentation: a plain inline marker
 * meant to sit at the end of an existing meta line (name · ticker · ...),
 * not a standalone pill banner repeated as its own row on every single
 * card — that was the single most-repeated identical element on the
 * whole screen, which reads as templated more than it reads as honest.
 * `<Text>` nests inline in React Native, so this drops directly into a
 * parent Text without its own layout.
 */
export default function MockDataFlag() {
  return <Text style={styles.text}> · Illustrative data</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.confidenceModerate,
  },
});
