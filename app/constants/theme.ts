/**
 * BioLens visual direction: premium / scientific / minimal.
 * No DNA-helix clip art, no neon "AI" gradients, no green=buy / red=sell.
 * Confidence and evidence strength are always categorical (High/Moderate/Low),
 * so the palette below has no bespoke "good/bad" hue pairing baked in.
 */
export const colors = {
  background: "#0B0F14",
  surface: "#12181F",
  surfaceRaised: "#1A222B",
  border: "#232C36",
  textPrimary: "#F4F6F8",
  textSecondary: "#9AA6B2",
  textTertiary: "#5F6B78",
  accent: "#5B8DEF", // used sparingly: links, active tab, primary actions
  accentMuted: "#2C3B52",
  confidenceHigh: "#8FB8A8",
  confidenceModerate: "#C9B27A",
  confidenceLow: "#8A8F98",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
};
