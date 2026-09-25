import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

/**
 * Standing footnote wherever BioLens's paper calls appear. The wording is
 * doing real work: calls are general research commentary published the
 * same to everyone (never tailored to anyone's holdings), and the track
 * record link keeps "likely positive/negative" honest by showing how past
 * calls actually held up, misses included.
 */
export default function ResearchDisclaimer() {
  const router = useRouter();
  return (
    <Text style={styles.text}>
      Papers and SEC filings found by BioLens&apos;s daily scan of PubMed and SEC EDGAR. Each call
      is BioLens&apos;s general read on what a paper means for the company — the same for every
      reader, not investment advice, and not a price prediction.{" "}
      <Text style={styles.link} onPress={() => router.push("/track-record")}>
        See how past calls held up
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  link: { color: colors.accent },
});
