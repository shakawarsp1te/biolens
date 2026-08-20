import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { PubMedPaper } from "../services/api";

/** Renders one live PubMed search result. Abstract text is truncated —
 * this is a search result row, not the full reading view — and metadata
 * fields degrade gracefully since PubMed records don't always have every
 * field populated. */
export default function PaperResultRow({ paper }: { paper: PubMedPaper }) {
  return (
    <View style={styles.row}>
      {paper.title ? <Text style={styles.title}>{paper.title}</Text> : null}
      <View style={styles.metaRow}>
        {paper.journal ? <Text style={styles.meta}>{paper.journal}</Text> : null}
        {paper.pub_date ? <Text style={styles.meta}>{paper.pub_date}</Text> : null}
      </View>
      {paper.abstract ? (
        <Text style={styles.abstract} numberOfLines={3}>
          {paper.abstract}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        {paper.pmid ? <Text style={styles.identifier}>PubMed {paper.pmid}</Text> : null}
        {paper.doi ? <Text style={styles.identifier}>DOI {paper.doi}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  abstract: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  footerRow: {
    flexDirection: "row",
  },
  identifier: {
    ...typography.caption,
    color: colors.textTertiary,
    marginRight: spacing.sm,
  },
});
