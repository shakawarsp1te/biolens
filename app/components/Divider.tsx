import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../constants/theme";

/**
 * The hairline that replaces "wrap every list item in its own rounded
 * card" — a real list (companies, drugs, trials, papers, pipeline assets)
 * is now a stack of full-bleed rows separated by this, matching how an
 * actual watchlist or transaction list reads in a real trading app.
 * Cards are reserved for genuinely singular modules now, not for "any
 * group of related text."
 */
export default function Divider() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
