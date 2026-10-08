import { Platform, useWindowDimensions, type ViewStyle } from "react-native";

/** Browser windows at least this wide get the desktop layout (sidebar nav,
 * centered content column) instead of the phone layout. */
export const WIDE_BREAKPOINT = 900;

/** Widest a page's content column grows on desktop — past this, lines of
 * body text get too long to read comfortably. */
export const CONTENT_MAX_WIDTH = 960;

/** Narrower column for single-form screens (log in, sign up, ...). */
export const FORM_MAX_WIDTH = 480;

export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WIDE_BREAKPOINT;
}

/** Centers a screen's content in a readable column on wide browser windows;
 * a no-op on phones and native, where the screen is already narrow. */
export const centeredColumn: ViewStyle = {
  width: "100%",
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: "center",
};
