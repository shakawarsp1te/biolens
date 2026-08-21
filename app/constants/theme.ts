/**
 * BioLens visual direction: premium / scientific / minimal, with a
 * confident, Robinhood-inspired design language — big bold numbers, a
 * near-black canvas, generous rounded surfaces, one disciplined accent
 * color used boldly rather than many colors used timidly.
 *
 * Still holds the line on BUILD_BRIEF.txt's non-negotiables: no DNA-helix
 * clip art, no neon "AI" gradients, no green=buy / red=sell. The accent
 * below is a deliberate cobalt blue, not green — Frontier Score and other
 * hero numbers must never read as "the stock is up." Confidence and
 * evidence strength stay on their own separate, muted, non-alarmist
 * palette, entirely independent of the brand accent.
 */
export const colors = {
  background: "#060708",
  surface: "#101317",
  surfaceRaised: "#1A1E24",
  surfaceSunken: "#000000",
  border: "#20242B",
  borderStrong: "#2C323C",
  textPrimary: "#F5F7FA",
  textSecondary: "#98A2B3",
  textTertiary: "#5D6470",
  // Primary brand color — used boldly (hero numbers, primary actions, the
  // active tab) rather than sprinkled as a timid tint. Deliberately blue,
  // never green, so it can never be misread as a "positive/buy" signal.
  accent: "#4C7EFF",
  accentMuted: "#182036",
  confidenceHigh: "#8FB8A8",
  confidenceModerate: "#C9B27A",
  confidenceLow: "#8A8F98",
  // Evidence classification (Phase 7) reuses the same muted, non-alarmist
  // palette as confidence — strength of evidence, not a buy/sell signal.
  evidenceConfirmatory: "#8FB8A8",
  evidenceEncouraging: "#4C7EFF",
  evidenceInconclusive: "#C9B27A",
  evidenceNegative: "#8A8F98",
  mockDataBanner: "#4A3F2A",
  // Real market price movement (app/services/api.ts's StockQuote) — the one
  // deliberate exception to "no green/red semantics" elsewhere in this
  // theme, because a stock's actual price change is a plain fact, not a
  // buy/sell signal BioLens is making. Kept muted, not neon, to match the
  // rest of the palette rather than reading as an alert.
  gain: "#7FB69A",
  loss: "#C97B7B",
} as const;

/**
 * Loaded via useFonts() in app/_layout.tsx (root layout gates rendering
 * until these resolve). Space Grotesk for anything with personality —
 * headlines, hero numbers, the wordmark — instead of the platform default
 * sans-serif every other app (and every quick AI-built prototype) reaches
 * for; JetBrains Mono for anything tabular (prices, percentages, trial
 * stats) so digits actually line up instead of a proportional font's
 * variable-width numerals shifting a price around as it updates.
 */
export const fontFamily = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_600SemiBold",
  mono: "JetBrainsMono_600SemiBold",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * Deliberately steep jumps between sizes (22->26->40 for headline->title->
 * hero) rather than a gentle type ramp — the "confident big number" feel
 * Robinhood is known for comes from contrast between hero stats and
 * everything around them, not from a subtle scale.
 */
export const typography = {
  hero: { fontSize: 40, fontFamily: fontFamily.display, letterSpacing: -0.5 },
  title: { fontSize: 26, fontFamily: fontFamily.display, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontFamily: fontFamily.displayMedium },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.3 },
  // Tabular numerals — opt in for anything showing a price, percentage, or
  // stat that updates, so digits don't jitter in width as they change.
  mono: { fontSize: 15, fontFamily: fontFamily.mono },
  monoLarge: { fontSize: 22, fontFamily: fontFamily.monoBold, letterSpacing: -0.3 },
};
