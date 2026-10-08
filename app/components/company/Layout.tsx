import React from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { spacing } from "../../constants/theme";

/** Window width at which dashboard panels sit side by side. Below it
 * (phones, tablets, narrow desktop windows minus the sidebar) they stack. */
const TWO_COLUMN_MIN = 1180;

export function useTwoColumn(): boolean {
  return useWindowDimensions().width >= TWO_COLUMN_MIN;
}

/** Main + side columns on wide screens, one column otherwise. */
export function Columns({
  main,
  side,
  sideWidth = 360,
}: {
  main: React.ReactNode;
  side: React.ReactNode;
  sideWidth?: number;
}) {
  const twoColumn = useTwoColumn();
  if (!twoColumn) {
    return (
      <Stack>
        {main}
        {side}
      </Stack>
    );
  }
  return (
    <View style={styles.row}>
      <Stack style={styles.main}>{main}</Stack>
      <Stack style={{ width: sideWidth }}>{side}</Stack>
    </View>
  );
}

/** Equal-width panels in a row on wide screens, stacked otherwise. */
export function Split({ children }: { children: React.ReactNode }) {
  const twoColumn = useTwoColumn();
  if (!twoColumn) return <Stack>{children}</Stack>;
  return (
    <View style={styles.row}>
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.main}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Vertical stack with the dashboard's standard gap. */
export function Stack({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.stack, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  main: { flex: 1, minWidth: 0 },
  stack: { gap: spacing.md },
});
