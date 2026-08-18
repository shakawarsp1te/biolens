import React from "react";
import MockCard from "../../components/MockCard";
import ScreenShell from "../../components/ScreenShell";

export default function ProfileScreen() {
  return (
    <ScreenShell title="Profile" subtitle="Account, disclaimers, and app settings.">
      <MockCard
        eyebrow="Placeholder"
        title="Supabase Auth wires up in Phase 0"
        body="Sign-in state, the not-investment-advice disclaimer, and settings will live here."
      />
    </ScreenShell>
  );
}
