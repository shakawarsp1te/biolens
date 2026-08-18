import React from "react";
import MockCard from "../../components/MockCard";
import ScreenShell from "../../components/ScreenShell";

// Real Discover (Frontier Score, filters, ~20 emerging companies) is Phase 8.
export default function DiscoverScreen() {
  return (
    <ScreenShell title="Discover" subtitle="Emerging oncology companies, ranked by research activity — not investment attractiveness.">
      <MockCard
        eyebrow="Placeholder"
        title="Frontier Score filters land in Phase 8"
        body="Therapeutic area, stage, modality, and target filters will appear here once seed data (Phase 2) and the scoring model exist."
      />
    </ScreenShell>
  );
}
