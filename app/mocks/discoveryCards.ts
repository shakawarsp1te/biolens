import { DiscoveryCardData } from "../types/domain";

/**
 * Mock data for the Phase 8 Discovery Card. The Cardiff Oncology entry
 * matches BUILD_BRIEF.txt §54's own worked example verbatim (score,
 * bullets, one-sentence summary, key risk) — same continuity approach as
 * mocks/companyProfile.ts using the brief's Janux example. The other three
 * are reformatted from the same real, individually-verified Phase 2 seed
 * research (api/db/seed/generate_oncology_seed.py) — no new facts, just a
 * different shape. Frontier Scores here are BioLens's own qualitative
 * estimates (same status as "confidence: moderate" elsewhere) — the actual
 * component-weighted formula lives in api/app/services/frontier_score.py.
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
    therapeuticArea: "Oncology",
    stage: "Phase II",
    maturity: "emerging",
    modalities: ["PLK1 inhibitor (small molecule)"],
    targets: ["PLK1"],
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
    therapeuticArea: "Oncology",
    stage: "Phase I",
    maturity: "emerging",
    modalities: ["Tumor-activated bispecific antibody (TRACTr)"],
    targets: ["PSMA"],
    isMockData: true,
  },
  {
    id: "co-3",
    name: "Erasca",
    ticker: "ERAS",
    frontierScore: 68,
    whyItSurfaced: [
      "Two distinct RAS-pathway programs in Phase I simultaneously (ERAS-0015, ERAS-4001)",
      "Positive preliminary dose-escalation data disclosed for the lead molecular glue",
      "Targets the broad RAS family rather than one hotspot mutation",
    ],
    oneSentenceSummary:
      "Erasca is a precision oncology company singularly focused on RAS/MAPK pathway-driven cancers, running a pan-RAS molecular glue and a pan-KRAS inhibitor in parallel.",
    keyRisk:
      "Both lead programs are still Phase I — neither has produced registration-directed data yet, so the platform thesis remains unproven in later-stage trials.",
    therapeuticArea: "Oncology",
    stage: "Phase I",
    maturity: "emerging",
    modalities: ["Molecular glue degrader", "KRAS inhibitor (small molecule)"],
    targets: ["Pan-RAS", "KRAS"],
    isMockData: true,
  },
  {
    id: "co-9",
    name: "Xencor",
    ticker: "XNCR",
    frontierScore: 58,
    whyItSurfaced: [
      "Two first-in-class bispecific T-cell engagers in Phase I (XmAb819, XmAb541)",
      "Confirmed partial responses already observed in the XmAb541 dose-escalation cohort",
      "Shifting toward a wholly-owned pipeline rather than pure licensing",
    ],
    oneSentenceSummary:
      "Xencor's XmAb bispecific-antibody platform is advancing two novel T-cell engagers — one targeting ENPP3 in kidney cancer, one targeting CLDN6 in gynecologic and germ cell tumors.",
    keyRisk:
      "Both programs are early Phase I dose-escalation — durability, tolerability at higher doses, and a path to a pivotal trial are all still unknown.",
    therapeuticArea: "Oncology",
    stage: "Phase I",
    maturity: "emerging",
    modalities: ["Bispecific T-cell engaging antibody (XmAb 2+1)"],
    targets: ["ENPP3", "CLDN6"],
    isMockData: true,
  },
];
