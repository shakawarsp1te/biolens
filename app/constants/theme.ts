/**
 * BioLens visual direction, v3 (Oct 2026): a research terminal. Modeled on
 * how institutional tools like Koyfin present information -- dense,
 * quiet, aligned -- with BioLens's own palette and type.
 *
 * - Charcoal/navy canvas in three steps (background < sidebar < surface)
 *   so structure comes from tone and hairlines, not boxes and shadows.
 * - Minimal radii (2-4px). Panels, tables and tabs, not floating cards.
 * - One sans family (IBM Plex Sans) everywhere; numbers that sit in
 *   columns use tabular figures (`numeric` below) so digits align.
 * - Teal is interface chrome only -- the active nav item, the selected
 *   tab, links, focus. Data values stay in text colors. BUILD_BRIEF.txt's
 *   non-negotiables still hold: no green=buy / red=sell. The only
 *   green/red is a stock's actual price change (gain/loss), muted.
 */
export const colors = {
  background: "#101820",
  sidebar: "#19232D",
  surface: "#202D39",
  surfaceRaised: "#263544",
  surfaceSunken: "#0C131A",
  /** Hairline separators inside panels and between table rows. */
  borderSubtle: "#2A3A48",
  border: "#344656",
  borderStrong: "#44596C",
  textPrimary: "#F1F5F9",
  textSecondary: "#AAB9C8",
  // Lightest gray that still clears 4.5:1 on `surface` -- for labels and
  // units, never for values someone needs to read.
  textTertiary: "#8494A5",
  accent: "#34C7A1",
  accentMuted: "#173A37",
  /** Text on an accent fill. */
  onAccent: "#06231C",
  confidenceHigh: "#8FB8A8",
  confidenceModerate: "#C9B27A",
  confidenceLow: "#8A8F98",
  // Evidence classification reuses the muted, non-alarmist confidence
  // palette -- strength of evidence, not a buy/sell signal. Encouraging is
  // its own blue (not the teal accent) so it can't read as "positive".
  evidenceConfirmatory: "#8FB8A8",
  evidenceEncouraging: "#7088E0",
  evidenceInconclusive: "#C9B27A",
  evidenceNegative: "#8A8F98",
  // Real market price movement only (see StockQuote) -- a plain fact, not
  // a signal BioLens is making. Muted, never neon.
  gain: "#6FB58F",
  loss: "#D07D7D",
  /** Chart series, in fixed order. Validated with the dataviz skill's
   * palette checker against `surface` in dark mode (lightness band, chroma,
   * colorblind separation, contrast). A third series needs re-validating. */
  chartSeries: ["#7088E0", "#27A584"] as const,
  /** One-series charts (and anything without a categorical identity). */
  chartNeutral: "#7E93A8",
  chartGrid: "#2A3A48",
} as const;

/**
 * Loaded via useFonts() in app/_layout.tsx. Every weight is its own family
 * name, because native platforms don't synthesize weights for custom fonts
 * -- components/ui/Text.tsx maps a style's fontWeight onto these.
 */
export const fontFamily = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
  bold: "IBMPlexSans_700Bold",
  // Kept for older call sites: headings and numbers are the same family
  // now, at a heavier weight.
  display: "IBMPlexSans_600SemiBold",
  displayMedium: "IBMPlexSans_500Medium",
  mono: "IBMPlexSans_500Medium",
  monoBold: "IBMPlexSans_600SemiBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
} as const;

export const radii = {
  sm: 2,
  md: 3,
  lg: 4,
  // Chips and pills are small rectangles in this design, not capsules.
  pill: 3,
  round: 999,
} as const;

/** Tabular figures: every digit the same width, so a column of numbers
 * lines up. For values in tables and stat rows; large standalone figures
 * read better with the font's default proportional digits. */
export const numeric = { fontVariant: ["tabular-nums" as const] };

/**
 * A compact ramp for a dense tool: 14px body, 12px labels, hierarchy from
 * weight and color more than size.
 */
export const typography = {
  hero: { fontSize: 28, fontFamily: fontFamily.semibold, letterSpacing: -0.3 },
  title: { fontSize: 20, fontFamily: fontFamily.semibold, letterSpacing: -0.2 },
  heading: { fontSize: 15, fontFamily: fontFamily.semibold },
  /** Panel titles. */
  panelTitle: { fontSize: 13, fontFamily: fontFamily.semibold },
  body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  // A genuine label -- a filter's name, a stat's name -- used where content
  // is ambiguous without one. Sentence case, never an all-caps eyebrow.
  label: { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0 },
  caption: { fontSize: 11, fontWeight: "400" as const, letterSpacing: 0 },
  mono: { fontSize: 14, fontFamily: fontFamily.mono, ...numeric },
  monoLarge: { fontSize: 20, fontFamily: fontFamily.monoBold, letterSpacing: -0.2, ...numeric },
};
