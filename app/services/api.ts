/**
 * Typed client for the BioLens API (api/app/routers/*). Only wraps the
 * read-only public-data endpoints that exist today (ClinicalTrials.gov,
 * PubMed) — no auth, no writes, matches what the backend actually exposes.
 *
 * Builds query strings manually (encodeURIComponent) rather than using
 * URL/URLSearchParams — those aren't reliably available across Hermes/iOS/
 * Android/web without a polyfill this project doesn't have, and a plain
 * string is all a GET query string needs.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(params)}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(
      "Could not reach the BioLens API. Make sure the backend is running locally " +
        "(cd api && uvicorn app.main:app --reload) and EXPO_PUBLIC_API_BASE_URL points at it.",
    );
  }
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      // response body wasn't JSON — fall through to the generic message below
    }
    throw new ApiError(detail ?? `Request failed (HTTP ${response.status})`, response.status);
  }
  return response.json();
}

// --- ClinicalTrials.gov (api/app/routers/clinicaltrials.py) ---

export interface TrialSearchResult {
  nct_id: string | null;
  brief_title: string | null;
  lead_sponsor: string | null;
  overall_status: string | null;
  phase: string | null;
  raw_phases: string[];
  enrollment_count: number | null;
  conditions: string[];
  interventions: string[];
  /** Only present on /search/intervention responses. */
  confident_match?: boolean;
}

export function searchTrialsBySponsor(name: string, pageSize = 10): Promise<TrialSearchResult[]> {
  return apiGet<TrialSearchResult[]>("/clinicaltrials/search/sponsor", {
    name,
    page_size: pageSize,
  });
}

export function searchTrialsByIntervention(
  name: string,
  pageSize = 10,
): Promise<TrialSearchResult[]> {
  return apiGet<TrialSearchResult[]>("/clinicaltrials/search/intervention", {
    name,
    page_size: pageSize,
  });
}

// --- PubMed (api/app/routers/pubmed.py) ---

export interface PubMedPaper {
  pmid: string | null;
  title: string | null;
  journal: string | null;
  pub_date: string | null;
  doi: string | null;
  abstract: string | null;
}

export interface PubMedPackage {
  query: string;
  paper_count: number;
  papers: PubMedPaper[];
}

export function searchPubMedByDrug(name: string, retmax = 5): Promise<PubMedPackage> {
  return apiGet<PubMedPackage>("/pubmed/drug", { name, retmax });
}
