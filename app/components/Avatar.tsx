import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, typography } from "../constants/theme";

// A small fixed palette so the same company always gets the same tint
// (hashed from its name) — Robinhood-style colored initial circles standing
// in for a real logo, not random per render.
const TINTS = ["#4C7EFF", "#8B6BFF", "#2FB7C3", "#C9A34E", "#E0679B", "#5AA9E6"];

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Leading circular avatar standing in for a company/drug logo, sized like
 * Robinhood's watchlist row icons. Deterministic per name — no randomness,
 * no external image fetch. */
export default function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const backgroundColor = tintFor(name);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radii.pill, backgroundColor }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    ...typography.caption,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
});
