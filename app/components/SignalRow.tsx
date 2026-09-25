import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { SignalEvent } from "../types/domain";
import ImpactCall from "./ImpactCall";

const SIGNAL_TYPE_LABEL: Record<SignalEvent["signalType"], string> = {
  new_paper: "New paper",
  new_filing: "New filing",
};

/**
 * One row for a signal BioLens's continuous scan found (see
 * SignalFeedCard.tsx for the company-profile use and app/(tabs)/index.tsx
 * for the cross-company Home feed use): the sourced fact itself, then — for
 * new papers BioLens has assessed — its call on whether the paper is likely
 * good or bad news for the company (ImpactCall). `companyName`, when given, prefixes the
 * meta line so a cross-company feed still reads clearly out of context;
 * omitted on a company's own profile, where that would be redundant.
 */
export default function SignalRow({
  signal,
  companyName,
}: {
  signal: SignalEvent;
  companyName?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={2}>
        {signal.title}
      </Text>
      <Text style={styles.meta}>
        {companyName ? `${companyName} · ` : ""}
        {SIGNAL_TYPE_LABEL[signal.signalType]}
        {signal.detail ? ` · ${signal.detail}` : ""}
        {signal.occurredAt ? ` · ${signal.occurredAt}` : ""}
      </Text>
      {signal.impact ? (
        <ImpactCall impact={signal.impact} outcome={signal.outcome} sourceUrl={signal.sourceUrl} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm + 2,
  },
  label: {
    ...typography.body,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
