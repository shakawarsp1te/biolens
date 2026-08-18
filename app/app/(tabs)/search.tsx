import React from "react";
import MockCard from "../../components/MockCard";
import ScreenShell from "../../components/ScreenShell";

export default function SearchScreen() {
  return (
    <ScreenShell title="Search" subtitle="Companies, drugs, targets, and trials.">
      <MockCard
        eyebrow="Placeholder"
        title="Search wires up once seed data exists"
        body="Company/drug/target search depends on Phase 2 (schema + seed data). This screen just confirms the tab and layout work."
      />
    </ScreenShell>
  );
}
