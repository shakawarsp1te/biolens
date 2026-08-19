/**
 * Shared domain types for Phase 1 components (CompanyCard, EventCard,
 * EvidenceBadge, SourceChip, DrugCard, TrialMetric).
 *
 * These mirror the eventual Phase 2 DB schema (companies, drugs, trials,
 * events, sources) closely enough that swapping mock data for live data
 * later shouldn't require touching component internals — just the screens
 * that supply props.
 */

/** Confidence/evidence strength is always categorical. Never a fabricated
 * numerical probability (e.g. "83.6% confidence") unless a real statistical
 * model backs it — see BUILD_BRIEF.txt §63. */
export type ConfidenceLevel = "high" | "moderate" | "low";

/** Evidence classification for a readout/event — BUILD_BRIEF.txt §7 (Phase 7
 * interpretation layer). Not a buy/sell signal, just what the data shows. */
export type EvidenceClassification =
  | "confirmatory_positive"
  | "encouraging_signal"
  | "inconclusive"
  | "negative_primary_endpoint";

export type TrialPhase =
  | "Preclinical"
  | "Phase I"
  | "Phase I/II"
  | "Phase II"
  | "Phase II/III"
  | "Phase III"
  | "Approved";

export type SourceType =
  | "clinicaltrials_gov"
  | "pubmed"
  | "press_release"
  | "sec_filing"
  | "conference"
  | "biolens_calculated";

export const sourceTypeLabels: Record<SourceType, string> = {
  clinicaltrials_gov: "ClinicalTrials.gov",
  pubmed: "PubMed",
  press_release: "Press release",
  sec_filing: "SEC filing",
  conference: "Conference",
  biolens_calculated: "BioLens calculated",
};

export interface Source {
  id: string;
  /** e.g. "NCT04538664", "PubMed 38291744" */
  label: string;
  type: SourceType;
}

export interface CompanySummary {
  id: string;
  name: string;
  /** Reference only — BioLens is never a stock picker, so this is never
   * paired with buy/sell language or a price target anywhere in the UI. */
  ticker?: string;
  stage: string;
  therapeuticArea: string;
  oneLiner: string;
  confidence: ConfidenceLevel;
  /** 0-100. Optional — the scoring model itself is Phase 8. */
  frontierScore?: number;
  isMockData?: boolean;
}

export interface DrugSummary {
  id: string;
  name: string;
  companyName: string;
  target: string;
  modality: string;
  phase: TrialPhase;
  indication: string;
  oneLiner: string;
  confidence: ConfidenceLevel;
  isMockData?: boolean;
}

export interface EventSummary {
  id: string;
  companyName: string;
  ticker?: string;
  phase: TrialPhase;
  eventType: string;
  /** ISO date string */
  date: string;
  title: string;
  bottomLine: string;
  evidenceClassification: EvidenceClassification;
  confidence: ConfidenceLevel;
  sources: Source[];
  isMockData?: boolean;
}

/** Deterministic-statistics display rules (Phase 6 applies to how these are
 * computed; this type just carries whatever was computed so the component
 * can render it without ever collapsing to a bare percentage). */
export type TrialMetricKind = "orr" | "hazard_ratio" | "pfs" | "os" | "generic";

export interface TrialMetricData {
  kind: TrialMetricKind;
  label: string;
  /** ORR only — always paired, never a bare percentage. */
  responders?: number;
  evaluable?: number;
  /** Hazard ratio only. */
  hazardRatio?: number;
  /** Generic / PFS / OS display value, e.g. "8.4 months". */
  value?: string;
  confidenceInterval?: [number, number];
  pValue?: number;
  endpointRole?: "primary" | "secondary" | "exploratory";
  /** Plain-language framing text — required for HR, optional elsewhere. */
  caption?: string;
  /** e.g. "Small sample size — interpret cautiously." */
  flag?: string;
}
