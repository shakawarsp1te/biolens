import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, typography } from "../../constants/theme";
import { Text } from "./Text";

type Tone = "neutral" | "accent" | "caution";

const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceRaised, border: colors.border },
  accent: { fg: colors.accent, bg: colors.accentMuted, border: colors.accentMuted },
  caution: { fg: colors.confidenceModerate, bg: "#2E2A1F", border: "#4A4128" },
};

/** A small rectangular label: a ticker, an exchange, a data-quality flag. */
export default function Tag({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
  text: { ...typography.caption, fontWeight: "500" },
});
