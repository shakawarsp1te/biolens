import { CompanySummary, DrugSummary, EventSummary, TrialMetricData } from "../types/domain";

/**
 * Mock data for previewing the Phase 1 components (CompanyCard, EventCard,
 * DrugCard, TrialMetric, EvidenceBadge, SourceChip) on Home/Discover before
 * real ClinicalTrials.gov/PubMed data exists (Phases 3-4) or seed data exists
 * (Phase 2). Every record is flagged isMockData — never presented as real.
 */

export const MOCK_EVENTS: EventSummary[] = [
  {
    id: "evt-1",
    companyName: "Janux Therapeutics",
    ticker: "JANX",
    phase: "Phase I",
    eventType: "Dose-escalation readout",
    date: "2026-08-11",
    title: "New clinical data — tumor-activated T-cell engager",
    bottomLine:
      "Early responses observed at higher dose levels, but the evaluable population is still small — durability and the confirmed response rate remain open questions.",
    evidenceClassification: "encouraging_signal",
    confidence: "moderate",
    sources: [
      { id: "src-1", label: "NCT05978011", type: "clinicaltrials_gov" },
      { id: "src-2", label: "Company press release, Aug 2026", type: "press_release" },
    ],
    isMockData: true,
  },
  {
    id: "evt-2",
    companyName: "Cardiff Oncology",
    ticker: "CRDF",
    phase: "Phase II",
    eventType: "Combination readout",
    date: "2026-08-05",
    title: "Onvansertib combination arm misses primary endpoint",
    bottomLine:
      "The combination arm did not meet its pre-specified primary endpoint. Exploratory subgroup signals exist but should not be read as a positive result.",
    evidenceClassification: "negative_primary_endpoint",
    confidence: "high",
    sources: [{ id: "src-3", label: "NCT04730258", type: "clinicaltrials_gov" }],
    isMockData: true,
  },
];

export const MOCK_COMPANIES: CompanySummary[] = [
  {
    id: "co-1",
    name: "Janux Therapeutics",
    ticker: "JANX",
    stage: "Clinical — Phase I",
    therapeuticArea: "Oncology",
    oneLiner: "Tumor-activated T-cell engager platform aiming to widen the therapeutic window versus first-generation bispecifics.",
    confidence: "moderate",
    frontierScore: 74,
    isMockData: true,
  },
  {
    id: "co-2",
    name: "Cardiff Oncology",
    ticker: "CRDF",
    stage: "Clinical — Phase II",
    therapeuticArea: "Oncology",
    oneLiner: "PLK1 inhibitor (onvansertib) in combination regimens for RAS-mutated colorectal and pancreatic cancer.",
    confidence: "moderate",
    frontierScore: 58,
    isMockData: true,
  },
];

export const MOCK_DRUGS: DrugSummary[] = [
  {
    id: "drug-1",
    name: "JANX007",
    companyName: "Janux Therapeutics",
    target: "PSMA",
    modality: "Tumor-activated bispecific antibody",
    phase: "Phase I",
    indication: "Metastatic castration-resistant prostate cancer",
    oneLiner: "Designed to stay inactive until it reaches tumor tissue, aiming to reduce the cytokine-release toxicity seen with earlier PSMA bispecifics.",
    confidence: "moderate",
    isMockData: true,
  },
];

export const MOCK_TRIAL_METRICS: TrialMetricData[] = [
  {
    kind: "orr",
    label: "Objective Response Rate",
    responders: 12,
    evaluable: 20,
    confidenceInterval: [36, 81],
    endpointRole: "secondary",
    caption: "The observed response is large, but the small evaluable population creates substantial uncertainty around the true effect.",
    flag: "Small sample size — interpret cautiously.",
  },
  {
    kind: "hazard_ratio",
    label: "Progression-Free Survival",
    hazardRatio: 0.7,
    confidenceInterval: [0.52, 0.94],
    pValue: 0.02,
    endpointRole: "primary",
    caption:
      "The treatment group experienced an estimated 30% lower instantaneous hazard of progression or death over the analyzed period.",
  },
];
