import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radii, spacing } from "../constants/theme";

/**
 * BioLens's own mark: three ascending bars (a signal reading upward — half
 * stock chart, half lab readout) in a rounded-square tile, the way a real
 * product has a specific, deliberate logo rather than just its name set in
 * the platform default font. Built from plain Views, not an image asset or
 * icon font glyph — nothing to bundle, load, or ship at the wrong
 * resolution.
 */
export default function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const tile = size === "sm" ? 28 : 36;
  const textSize = size === "sm" ? 16 : 20;

  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: tile, height: tile }]}>
        <View style={[styles.bar, { height: tile * 0.35 }]} />
        <View style={[styles.bar, { height: tile * 0.6 }]} />
        <View style={[styles.bar, { height: tile * 0.85, backgroundColor: colors.textPrimary }]} />
      </View>
      <Text style={[styles.wordmarkText, { fontSize: textSize }]}>BioLens</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  tile: {
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 5,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.background,
    opacity: 0.85,
  },
  wordmarkText: {
    fontFamily: fontFamily.display,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    letterSpacing: -0.3,
  },
});
