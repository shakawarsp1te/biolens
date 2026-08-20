import { CompanyProfile } from "../types/domain";

/**
 * Mock company profiles for the Phase 2 profile page (BUILD_BRIEF.txt
 * §18-21). All four are grounded in real, web-search-verified facts from
 * the same Phase 2 research as api/db/seed/generate_oncology_seed.py — not
 * wired to a live API yet (that's a later phase), so still flagged as mock
 * data. Keyed by id so /company/[id] can look up the right one instead of
 * always showing the same company regardless of which Discovery Card was
 * tapped.
 *
 * biolensSummary is kept to 3 sentences per §18: what the company does, why
 * the tech is interesting, what determines near-term success.
 */
export const MOCK_COMPANY_PROFILES: Record<string, CompanyProfile> = {
  "co-1": {
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
  },

  "co-2": {
    id: "co-2",
    name: "Cardiff Oncology",
    ticker: "CRDF",
    status: "Emerging clinical-stage biotech (single-asset)",
    primaryFocus: "Oncology",
    technology: "PLK1 inhibition (onvansertib)",
    biolensSummary:
      "Cardiff Oncology is a single-asset biotech developing onvansertib, an oral PLK1 inhibitor, in combination " +
      "regimens for RAS-mutated colorectal cancer. Its CRDF-004 trial reported a 72.2% response rate combining " +
      "onvansertib with FOLFIRI and bevacizumab in first-line metastatic colorectal cancer — a notably high " +
      "number for a single-arm cohort. Near-term success depends on whether that result can be confirmed in a " +
      "larger or randomized trial design, since no concurrent control arm exists yet.",
    whyItMatters: [
      "The company's valuation rests almost entirely on the clinical development of onvansertib, its only clinical-stage asset.",
      "The reported 72.2% response rate in first-line RAS-mutated metastatic colorectal cancer is unusually high for this setting — exactly why it needs to be read cautiously rather than at face value.",
      "The major remaining uncertainty is whether this single-arm result would hold up against a concurrent control arm, since no randomized comparison exists yet.",
      "As a single-asset company, any safety, efficacy, or regulatory setback for onvansertib affects the entire company at once — there is no second program to fall back on.",
    ],
    pipeline: [
      {
        drugId: "drug-2",
        drugName: "Onvansertib",
        target: "PLK1",
        modality: "PLK1 inhibitor (small molecule)",
        disease: "First-line RAS-mutated metastatic colorectal cancer",
        stage: "Phase II",
        trialIds: ["NCT06106308"],
        nextMilestone: "Registrational trial design following CRDF-004 data",
      },
    ],
    thesisMap: {
      whatHasToGoRight: [
        "The 72.2% response rate needs to be reproduced in a larger, ideally randomized population before it can be treated as a reliable estimate.",
        "Duration of response needs to be meaningful — a high response rate that fades quickly is a weaker signal than the topline number suggests.",
        "Grade 3/4 toxicity needs to stay manageable at the selected dose as more patients are treated.",
        "Regulators need to agree that this single-arm data, or a follow-up randomized trial, is sufficient for a registrational pathway.",
        "Competing therapies for RAS-mutated metastatic colorectal cancer can't materially outperform onvansertib combinations before Cardiff reaches later-stage data.",
      ],
      whatCouldGoWrong: [
        "Response rate regresses toward historical norms as the evaluable population grows — a common pattern for early, favorable-risk cohorts.",
        "A future randomized trial fails to show the same magnitude of benefit over FOLFIRI/bevacizumab alone.",
        "Toxicity limits the population able to tolerate the combination at an effective dose.",
        "Regulators require a full randomized trial before considering approval, extending the timeline substantially.",
        "As a single-asset company, financing constraints could force difficult trade-offs if the registrational path lengthens.",
      ],
    },
    confidence: "moderate",
    isMockData: true,
  },

  "co-3": {
    id: "co-3",
    name: "Erasca",
    ticker: "ERAS",
    status: "Emerging clinical-stage biotech",
    primaryFocus: "Oncology",
    technology: "RAS/MAPK pathway-targeted therapeutics",
    biolensSummary:
      "Erasca is a precision oncology company built entirely around RAS/MAPK pathway-driven cancers, running two " +
      "distinct Phase I programs in parallel: ERAS-0015, a pan-RAS molecular glue, and ERAS-4001, a pan-KRAS " +
      "inhibitor. Early dose-escalation data for ERAS-0015 has shown preliminary activity in KRAS-mutant solid " +
      "tumors, though both programs remain in small-cohort, early-stage trials. Near-term success depends on " +
      "whether either program's Phase I data is strong enough to justify a registration-enabling trial design.",
    whyItMatters: [
      "The company's valuation depends on two early-stage RAS-pathway programs advancing simultaneously, rather than a single de-risked asset.",
      "A pan-RAS or pan-KRAS therapy that works across multiple mutations, rather than one specific hotspot, would address a broader patient population than mutation-specific competitors.",
      "The major remaining uncertainty is whether either program's preliminary Phase I activity translates into a registration-enabling trial design.",
      "Running two RAS-pathway programs at once diversifies platform risk somewhat, but both still depend on the same underlying biological thesis working out.",
    ],
    pipeline: [
      {
        drugId: "drug-3",
        drugName: "ERAS-0015",
        target: "Pan-RAS",
        modality: "Molecular glue degrader",
        disease: "RAS-mutant solid tumors",
        stage: "Phase I",
        trialIds: ["NCT06983743"],
        nextMilestone: "Updated Phase I dose-escalation data",
      },
      {
        drugId: "drug-4",
        drugName: "ERAS-4001",
        target: "KRAS",
        modality: "KRAS inhibitor (small molecule)",
        disease: "KRAS-mutant solid tumors",
        stage: "Phase I",
        trialIds: [],
        nextMilestone: "Preliminary Phase I monotherapy data (2H 2026)",
      },
    ],
    thesisMap: {
      whatHasToGoRight: [
        "ERAS-0015's preliminary activity needs to hold up and deepen as the evaluable population grows.",
        "ERAS-4001 needs to show it can differentiate from other KRAS-directed therapies already in development.",
        "Both programs need tolerable safety profiles at doses that also show meaningful activity.",
        "At least one program needs Phase I data strong enough to support a registration-enabling trial design.",
        "The pan-RAS/pan-KRAS mechanism needs to actually deliver broader applicability than mutation-specific competitors, not just in theory.",
      ],
      whatCouldGoWrong: [
        "Early activity signals shrink as more patients are enrolled, a common pattern in small Phase I cohorts.",
        "A mutation-specific competitor (e.g., a KRAS G12C- or G12D-specific inhibitor) outperforms Erasca's broader-spectrum approach in its narrower population.",
        "Running two similar-mechanism RAS programs at once splits management and financial resources rather than truly diversifying risk.",
        "Toxicity tied to broader RAS-pathway inhibition (rather than a single mutation) limits the tolerable dose.",
        "Neither program reaches a registration-enabling design before financing runway becomes a constraint.",
      ],
    },
    confidence: "low",
    isMockData: true,
  },

  "co-9": {
    id: "co-9",
    name: "Xencor",
    ticker: "XNCR",
    status: "Emerging clinical-stage biotech (shifting to wholly-owned pipeline)",
    primaryFocus: "Oncology",
    technology: "XmAb bispecific antibody engineering platform",
    biolensSummary:
      "Xencor's XmAb platform engineers bispecific antibodies, and the company is now advancing two wholly-owned, " +
      "first-in-class T-cell engagers in oncology: XmAb819, targeting ENPP3 in clear cell renal cell carcinoma, " +
      "and XmAb541, targeting CLDN6 in gynecologic and germ cell tumors. Both remain in Phase I dose escalation, " +
      "though XmAb541 has already shown confirmed partial responses in ovarian cancer and germ cell tumor " +
      "patients. Near-term success depends on whether either program's early activity holds up as dosing " +
      "expands and a recommended Phase 2 dose can be identified with a manageable safety profile.",
    whyItMatters: [
      "Xencor's shift from a licensing-heavy business model toward wholly-owned assets changes how much of any future success accrues to the company directly.",
      "Confirmed partial responses in XmAb541's early dose-escalation cohort are a genuine early efficacy signal, though from a very small number of patients.",
      "The major remaining uncertainty is whether either bispecific's activity and tolerability profile hold up as the dose-escalation cohorts expand.",
      "As a platform company with a broader historical partnered pipeline, this profile covers only Xencor's wholly-owned oncology programs, not the company as a whole.",
    ],
    pipeline: [
      {
        drugId: "drug-14",
        drugName: "XmAb819",
        target: "ENPP3",
        modality: "Bispecific T-cell engaging antibody (XmAb 2+1)",
        disease: "Advanced clear cell renal cell carcinoma",
        stage: "Phase I",
        trialIds: ["NCT05433142"],
        nextMilestone: "Recommended Phase 3 dose data (2H 2026)",
      },
      {
        drugId: "drug-15",
        drugName: "XmAb541",
        target: "CLDN6",
        modality: "Bispecific T-cell engaging antibody (XmAb 2+1)",
        disease: "Advanced gynecologic and germ cell tumors",
        stage: "Phase I",
        trialIds: ["NCT06276491"],
        nextMilestone: "Expanded dose-escalation data",
      },
    ],
    thesisMap: {
      whatHasToGoRight: [
        "XmAb541's confirmed partial responses need to persist and extend to more patients as enrollment continues.",
        "XmAb819 needs to show a clear efficacy signal in ccRCC to justify advancing toward a pivotal study.",
        "Both bispecifics need tolerable safety profiles (including cytokine-release risk, common to T-cell engagers) at doses that also show activity.",
        "A recommended Phase 2/3 dose needs to be identified for at least one program before a pivotal trial can be designed.",
        "Xencor's broader wholly-owned-pipeline strategy needs enough capital runway to carry these programs through Phase I without needing a new partnership.",
      ],
      whatCouldGoWrong: [
        "Confirmed responses don't extend beyond the small number of patients already reported.",
        "Cytokine-release syndrome or other on-target toxicity limits how high the dose can go, capping efficacy.",
        "A competing bispecific or cell therapy targeting the same antigens reaches later-stage data first.",
        "Xencor licenses one or both programs to a partner before pivotal data, changing how much of any future success the company itself captures.",
        "Financing constraints slow enrollment or force prioritization between the two programs.",
      ],
    },
    confidence: "low",
    isMockData: true,
  },
};
