import React from "react";
import { StyleSheet } from "react-native";
import { colors, typography } from "../../constants/theme";
import { Text } from "./Text";

/** The visible stand-in for a value BioLens doesn't have. Says why in
 * words ("Not reported", "No US-GAAP filings") rather than a bare dash, so
 * a gap never reads as zero or as a loading glitch. */
export default function Missing({ label = "Not available" }: { label?: string }) {
  return <Text style={styles.text}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    ...typography.label,
    fontWeight: "400",
    color: colors.textTertiary,
    fontStyle: "italic",
  },
});
