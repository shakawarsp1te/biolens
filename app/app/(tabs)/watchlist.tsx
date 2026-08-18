import React from "react";
import MockCard from "../../components/MockCard";
import ScreenShell from "../../components/ScreenShell";

// Real watchlist persistence (follow/unfollow -> `watchlists` table) is Phase 9.
export default function WatchlistScreen() {
  return (
    <ScreenShell title="Watchlist" subtitle="Companies, drugs, and targets you're following.">
      <MockCard
        eyebrow="Empty state"
        title="Nothing followed yet"
        body="Once Discover and company pages exist, following a company/drug/target will show it here."
      />
    </ScreenShell>
  );
}
