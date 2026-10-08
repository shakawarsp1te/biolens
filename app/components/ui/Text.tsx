import React from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";
import { fontFamily } from "../../constants/theme";

const FAMILY_BY_WEIGHT: Record<string, string> = {
  "100": fontFamily.regular,
  "200": fontFamily.regular,
  "300": fontFamily.regular,
  "400": fontFamily.regular,
  normal: fontFamily.regular,
  "500": fontFamily.medium,
  "600": fontFamily.semibold,
  "700": fontFamily.bold,
  "800": fontFamily.bold,
  "900": fontFamily.bold,
  bold: fontFamily.bold,
};

/** Resolves a style's fontWeight to the matching IBM Plex Sans family
 * unless the style already names a family. Custom fonts load one family
 * per weight, and native platforms don't synthesize a bold from a regular
 * file, so `fontWeight: "600"` alone would render in the system font. */
function withFont(style: TextProps["style"]): TextStyle[] {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return [flat];
  const family = FAMILY_BY_WEIGHT[String(flat.fontWeight ?? "400")] ?? fontFamily.regular;
  return [flat, { fontFamily: family, fontWeight: undefined }];
}

/** Drop-in for react-native's Text that renders in the app's typeface. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={withFont(style)} />;
}

/** Drop-in for react-native's TextInput that renders in the app's typeface. */
export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  return <RNTextInput ref={ref} {...props} style={withFont(style)} />;
});

export default Text;
