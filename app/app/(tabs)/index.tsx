import React from "react";
import EventCard from "../../components/EventCard";
import ScreenShell from "../../components/ScreenShell";
import { MOCK_EVENTS } from "../../mocks/phase1Preview";

// Home = "The Frontier" feed. Mock data only until Phase 8 (Discover) and the
// ClinicalTrials.gov / PubMed integrations (Phases 3-4) exist. Never present
// mock data as real — see PLAN.md working agreements.
export default function HomeScreen() {
  return (
    <ScreenShell brand title="The Frontier" subtitle="What's moving biotechnology forward today?">
      {MOCK_EVENTS.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </ScreenShell>
  );
}
