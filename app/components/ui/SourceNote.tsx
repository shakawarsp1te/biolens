import React from "react";
import { Linking, StyleSheet } from "react-native";
import { colors, typography } from "../../constants/theme";
import { Text } from "./Text";

/** The attribution line under a panel: where the numbers came from, and
 * as of when. Every data panel gets one -- BioLens never shows a figure
 * without saying where it's from. */
export default function SourceNote({
  source,
  url,
  children,
}: {
  source: string;
  url?: string;
  /** Extra method or as-of text after the source. */
  children?: React.ReactNode;
}) {
  return (
    <Text style={styles.text}>
      Source:{" "}
      {url ? (
        <Text style={styles.link} onPress={() => Linking.openURL(url)}>
          {source}
        </Text>
      ) : (
        source
      )}
      {children ? <Text> · {children}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { ...typography.caption, color: colors.textTertiary, lineHeight: 16 },
  link: { color: colors.textSecondary, textDecorationLine: "underline" },
});
