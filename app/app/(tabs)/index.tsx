import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import Divider from "../../components/Divider";
import EventCard from "../../components/EventCard";
import ListContainer from "../../components/ListContainer";
import ResearchDisclaimer from "../../components/ResearchDisclaimer";
import ScreenShell from "../../components/ScreenShell";
import SignalRow from "../../components/SignalRow";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { MOCK_EVENTS } from "../../mocks/phase1Preview";
import { getRecentSignals } from "../../services/api";
import { SignalEvent } from "../../types/domain";

// Home = "The Frontier" feed. The curated event feed below is still mock
// data (Phase 8's readout-interpretation pipeline — FACT/CALCULATED/
// INTERPRETATION separation, evidence classification — is a deeper feature
// than this pass builds); never presented as real. "What's new" beneath it
// is the opposite: real, live output of the continuous-scan pipeline
// (api/app/services/scan.py) across every tracked company — this is what
// makes Home an actually self-updating front door, not a static screen.
//
// Feed items are separated by a hairline, generous whitespace, and their
// own internal hierarchy — not identically boxed cards stacked with gaps
// between them.
export default function HomeScreen() {
  const { getById } = useCompanies();
  const [signals, setSignals] = useState<SignalEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentSignals(10)
      .then((result) => {
        if (!cancelled) setSignals(result);
      })
      .catch(() => {
        if (!cancelled) setSignals([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScreenShell brand title="The Frontier" subtitle="What's moving biotechnology forward today?">
      {MOCK_EVENTS.map((event, i) => (
        <React.Fragment key={event.id}>
          {i > 0 ? <Divider /> : null}
          <EventCard event={event} />
        </React.Fragment>
      ))}

      {signals && signals.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>What&apos;s new</Text>
          <ListContainer>
            {signals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                companyName={getById(signal.companyId)?.name}
              />
            ))}
          </ListContainer>
          <ResearchDisclaimer />
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = {
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
} as const;
