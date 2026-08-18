import React from "react";
import MockCard from "../../components/MockCard";
import ScreenShell from "../../components/ScreenShell";

// Home = "The Frontier" feed. Mock data only until Phase 8 (Discover) and the
// ClinicalTrials.gov / PubMed integrations (Phases 3-4) exist. Never present
// mock data as real — see PLAN.md working agreements.
const MOCK_EVENTS = [
  {
    eyebrow: "JANX · Janux Therapeutics · Phase I",
    title: "New clinical data — tumor-activated T-cell engager",
    body: "Why it matters: first meaningful human efficacy signal for one of Janux's lead programs. (Mock data — not yet sourced.)",
  },
  {
    eyebrow: "CRDF · Cardiff Oncology · Phase II",
    title: "Onvansertib combination readout",
    body: "Why it matters: placeholder card proving the feed layout before real ClinicalTrials.gov ingestion exists. (Mock data.)",
  },
];

export default function HomeScreen() {
  return (
    <ScreenShell title="The Frontier" subtitle="What's moving biotechnology forward today?">
      {MOCK_EVENTS.map((event) => (
        <MockCard key={event.title} {...event} />
      ))}
    </ScreenShell>
  );
}
