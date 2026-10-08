import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { Text } from "./Text";

type Props = {
  title?: string;
  /** Short context after the title -- a unit, a period, a count. */
  meta?: string;
  /** Right side of the header: a link, a toggle, a range selector. */
  action?: React.ReactNode;
  /** Drop the body padding -- for tables and lists that run edge to edge. */
  flush?: boolean;
  /** Attribution under the content (see SourceNote). */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** The basic unit of a research view: a titled, hairline-bordered region
 * on the surface tone. Deliberately plain -- structure, not decoration. */
export default function Panel({ title, meta, action, flush, footer, style, children }: Props) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
            {meta ? (
              <Text style={styles.meta}>
                {"  "}
                {meta}
              </Text>
            ) : null}
          </Text>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      <View style={flush ? null : styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  header: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  title: {
    ...typography.panelTitle,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  action: { flexDirection: "row", alignItems: "center" },
  body: { padding: spacing.md },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
