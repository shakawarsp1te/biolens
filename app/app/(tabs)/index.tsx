import React from "react";
import Divider from "../../components/Divider";
import EventCard from "../../components/EventCard";
import ScreenShell from "../../components/ScreenShell";
import { MOCK_EVENTS } from "../../mocks/phase1Preview";

// Home = "The Frontier" feed. Mock data only until Phase 8 (Discover) and the
// ClinicalTrials.gov / PubMed integrations (Phases 3-4) exist. Never present
// mock data as real — see PLAN.md working agreements.
//
// Feed items are separated by a hairline, generous whitespace, and their
// own internal hierarchy — not identically boxed cards stacked with gaps
// between them.
export default function HomeScreen() {
  return (
    <ScreenShell brand title="The Frontier" subtitle="What's moving biotechnology forward today?">
      {MOCK_EVENTS.map((event, i) => (
        <React.Fragment key={event.id}>
          {i > 0 ? <Divider /> : null}
          <EventCard event={event} />
        </React.Fragment>
      ))}
    </ScreenShell>
  );
}
