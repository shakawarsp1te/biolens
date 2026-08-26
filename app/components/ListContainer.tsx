import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../constants/theme";
import Divider from "./Divider";

/**
 * One rounded surface holding many divided rows — the real middle ground
 * between "every item is its own repeated card" (the old, templated-
 * looking pattern) and "no visual grouping at all." A grouped settings
 * list or a real watchlist reads exactly this way: one contained module,
 * hairlines between its rows, not N identical boxes stacked with gaps
 * between them.
 */
export default function ListContainer({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.container}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          <View style={styles.inset}>{child}</View>
          {i < items.length - 1 ? <Divider /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  inset: {
    paddingHorizontal: spacing.md,
  },
});
