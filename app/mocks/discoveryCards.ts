import { DiscoveryCardData } from "../types/domain";

/**
 * Mock data for the Phase 8 Discovery Card. The Cardiff Oncology entry
 * matches BUILD_BRIEF.txt §54's own worked example verbatim (score,
 * bullets, one-sentence summary, key risk) — same continuity approach as
 * mocks/companyProfile.ts using the brief's Janux example.
 */
export const MOCK_DISCOVERY_CARDS: DiscoveryCardData[] = [
  {
    id: "co-2",
    name: "Cardiff Oncology",
    ticker: "CRDF",
    frontierScore: 81,
    whyItSurfaced: [
      "Phase II colorectal cancer results",
      "Lead program advancing toward registrational development",
      "Targets PLK1",
    ],
    oneSentenceSummary:
      "Cardiff is developing onvansertib as a combination therapy for RAS-mutated metastatic colorectal cancer.",
    keyRisk: "Clinical thesis remains heavily dependent on one lead asset.",
    isMockData: true,
  },
  {
    id: "co-1",
    name: "Janux Therapeutics",
    ticker: "JANX",
    frontierScore: 61,
    whyItSurfaced: [
      "Encouraging Phase I anti-tumor activity in mCRPC",
      "Phase 1b expansion dose-regimen data expected next",
      "Targets PSMA via a tumor-activated engager platform",
    ],
    oneSentenceSummary:
      "Janux is developing JANX007, a tumor-activated T-cell engager designed to widen the therapeutic window versus earlier PSMA bispecifics.",
    keyRisk:
      "The company's second program was discontinued after Phase I data proved insufficient, narrowing the near-term thesis to one asset.",
    isMockData: true,
  },
];
