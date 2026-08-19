import { CompanyProfile } from "../types/domain";

/**
 * Mock company profile for the Phase 2 profile page (BUILD_BRIEF.txt §18-21).
 * Content is grounded in real, web-search-verified facts about Janux
 * Therapeutics (the brief's own worked example, §18) as of Aug 2026 — see
 * api/db/seed/README.md for the same company in the DB seed data — but this
 * screen isn't wired to a live API yet (that's later phases), so it's still
 * flagged as mock data.
 *
 * biolensSummary is kept to 3 sentences per §18: what the company does, why
 * the tech is interesting, what determines near-term success.
 */
export const MOCK_COMPANY_PROFILE: CompanyProfile = {
  id: "co-1",
  name: "Janux Therapeutics",
  ticker: "JANX",
  status: "Emerging clinical-stage biotech",
  primaryFocus: "Oncology",
  technology: "Tumor-activated immunotherapy (TRACTr platform)",
  biolensSummary:
    "Janux Therapeutics develops tumor-activated T-cell engagers (TRACTr) designed to stay inactive until " +
    "they reach tumor tissue, aiming to widen the therapeutic window that has limited earlier bispecific " +
    "antibodies. Its lead program, JANX007, has shown encouraging early anti-tumor activity in metastatic " +
    "castration-resistant prostate cancer with a manageable safety profile. Near-term success depends on " +
    "whether that activity holds up in the larger Phase 1b expansion and, eventually, a randomized trial.",
  whyItMatters: [
    "The company's valuation is heavily influenced by the clinical development of its lead program, JANX007, in prostate cancer.",
    "Early clinical evidence could validate Janux's tumor-activated T-cell engager platform more broadly, not just this one drug.",
    "The major remaining uncertainty is whether the anti-tumor activity observed in early patients persists across larger cohorts without unacceptable toxicity.",
    "The company's second program, targeting a different tumor antigen, was discontinued in 2026 after Phase 1 data proved insufficient — a reminder that platform breadth doesn't guarantee every program succeeds.",
  ],
  pipeline: [
    {
      drugId: "drug-1",
      drugName: "JANX007",
      target: "PSMA",
      modality: "Tumor-activated bispecific antibody (TRACTr)",
      disease: "Metastatic castration-resistant prostate cancer",
      stage: "Phase I",
      trialIds: ["NCT05519449"],
      nextMilestone: "Phase 1b expansion dose-regimen data",
    },
  ],
  thesisMap: {
    whatHasToGoRight: [
      "JANX007's early anti-tumor activity needs to hold up as the evaluable population grows.",
      "Cytokine-release and other on-target toxicities must stay manageable at the selected once-weekly step-dose regimens.",
      "Response durability needs to improve or persist with longer follow-up.",
      "The Phase 1b expansion needs to confirm what Phase 1a suggested before a registrational trial can be designed.",
      "Competing PSMA-directed therapies (radioligands, other T-cell engagers) can't materially outperform JANX007 on efficacy or tolerability.",
    ],
    whatCouldGoWrong: [
      "Response rate falls as more patients are enrolled — a common pattern when early data comes from a small, possibly favorable-risk group.",
      "Adverse events limit how high the dose can safely go, capping efficacy.",
      "A competing PSMA-targeted therapy reaches later-stage data first.",
      "Trial design choices (single-arm, small cohorts) produce data that's hard to interpret cleanly.",
      "Financing needs increase if the path to registration lengthens — irrelevant to the science, but relevant to whether the program keeps moving.",
    ],
  },
  confidence: "moderate",
  isMockData: true,
};
