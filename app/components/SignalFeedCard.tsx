import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { getCompanySignals } from "../services/api";
import { SignalEvent } from "../types/domain";
import ListContainer from "./ListContainer";
import ResearchDisclaimer from "./ResearchDisclaimer";
import SignalRow from "./SignalRow";

/**
 * Papers and SEC filings BioLens's continuous background scan has found
 * for this company since the last pass (api/app/services/scan.py) — every
 * row a real, sourced fact, with BioLens's call on new papers underneath
 * (see ImpactCall.tsx). Fetches
 * independently on mount, same self-contained pattern as
 * CatalystCalendarCard/FinancialHealthCard; silently renders nothing while
 * loading or if nothing new has turned up, since that's the common,
 * expected outcome of most scans.
 */
export default function SignalFeedCard({ companyId }: { companyId: string }) {
  const [signals, setSignals] = useState<SignalEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanySignals(companyId)
      .then((result) => {
        if (!cancelled) setSignals(result);
      })
      .catch(() => {
        if (!cancelled) setSignals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!signals || signals.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Recently found</Text>
      <ListContainer>
        {signals.map((signal) => (
          <SignalRow key={signal.id} signal={signal} />
        ))}
      </ListContainer>
      <ResearchDisclaimer />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
