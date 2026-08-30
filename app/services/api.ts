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

import { CompanyRecord } from "../types/domain";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status?: number;
  /** Populated only when the backend's `detail` was a list of strings (e.g.
   * /auth/signup's password-complexity violations) rather than one message
   * — callers that want to render a checklist can use this instead of the
   * flattened `message`. */
  violations?: string[];
  constructor(message: string, status?: number, violations?: string[]) {
    super(message);
    this.status = status;
    this.violations = violations;
  }
}

function parseErrorDetail(body: unknown): { message?: string; violations?: string[] } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return { message: detail };
  if (Array.isArray(detail) && detail.every((item) => typeof item === "string")) {
    return { message: detail.join(" "), violations: detail as string[] };
  }
  return {};
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
  headers: Record<string, string> = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(params)}`;
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new ApiError(
      "Could not reach the BioLens API. Make sure the backend is running locally " +
        "(cd api && uvicorn app.main:app --reload) and EXPO_PUBLIC_API_BASE_URL points at it.",
    );
  }
  if (!response.ok) {
    let parsed: { message?: string; violations?: string[] } = {};
    try {
      parsed = parseErrorDetail(await response.json());
    } catch {
      // response body wasn't JSON — fall through to the generic message below
    }
    throw new ApiError(
      parsed.message ?? `Request failed (HTTP ${response.status})`,
      response.status,
      parsed.violations,
    );
  }
  return response.json();
}

async function apiSend<T>(
  method: "POST" | "DELETE" | "PATCH",
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Could not reach the BioLens API. Make sure the backend is running locally " +
        "(cd api && uvicorn app.main:app --reload) and EXPO_PUBLIC_API_BASE_URL points at it.",
    );
  }
  if (!response.ok) {
    let parsed: { message?: string; violations?: string[] } = {};
    try {
      parsed = parseErrorDetail(await response.json());
    } catch {
      // response body wasn't JSON — fall through to the generic message below
    }
    throw new ApiError(
      parsed.message ?? `Request failed (HTTP ${response.status})`,
      response.status,
      parsed.violations,
    );
  }
  return response.json();
}

function apiPost<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  return apiSend<T>("POST", path, body, headers);
}

function apiDelete<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  return apiSend<T>("DELETE", path, body, headers);
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

// --- Ask BioLens (api/app/routers/ask.py) ---

export interface AskBioLensResult {
  answer: string;
  has_sufficient_evidence: boolean;
  source_ids_used: string[];
}

/** Scoped strictly to the facts/calculated/source_ids passed in — this is
 * "ask about the current research package," never an open-web question. */
export function askBioLens(params: {
  question: string;
  facts: string[];
  calculated?: string[];
  sourceIds?: string[];
}): Promise<AskBioLensResult> {
  return apiPost<AskBioLensResult>("/analyze/ask", {
    question: params.question,
    facts: params.facts,
    calculated: params.calculated ?? [],
    source_ids: params.sourceIds ?? [],
  });
}

// --- Market data (api/app/routers/market.py) ---

export interface StockQuote {
  ticker: string;
  company_name: string | null;
  price: number;
  currency: string | null;
  change: number;
  change_percent: number | null;
  previous_close: number;
  day_high: number | null;
  day_low: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  volume: number | null;
  exchange: string | null;
  market_time: string | null;
}

/** Factual current price for a real ticker — never paired with buy/sell/
 * price-target framing anywhere it's rendered. Returns null (not a thrown
 * ApiError) on a 404, since "no quote available" is a normal, expected
 * outcome for a private company or an unrecognized ticker — every caller
 * should treat it exactly like Ask BioLens's "insufficient evidence": a
 * plain empty state, not an error banner. */
export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  try {
    return await apiGet<StockQuote>(`/market/quote/${encodeURIComponent(ticker)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y";

export interface StockHistoryPoint {
  /** Unix seconds. */
  time: number;
  close: number;
}

export interface StockHistory {
  ticker: string;
  range: ChartRange;
  points: StockHistoryPoint[];
}

export async function getStockHistory(
  ticker: string,
  range: ChartRange,
): Promise<StockHistory | null> {
  try {
    return await apiGet<StockHistory>(`/market/history/${encodeURIComponent(ticker)}`, { range });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Cash on hand, last reported quarterly operating burn, and the runway
 * that implies — computed deterministically from the company's own SEC
 * filings (api/app/services/financial_health.py), never estimated by an
 * LLM. `runwayMonths` is null either when burn couldn't be determined at
 * all, or when operating cash flow was positive last quarter (`note`
 * explains which). */
export interface FinancialHealth {
  ticker: string;
  companyName: string | null;
  cashOnHand: number;
  cashAsOf: string;
  quarterlyBurn: number | null;
  burnPeriodStart: string | null;
  burnPeriodEnd: string | null;
  burnIsEstimated: boolean;
  filingForm: string | null;
  runwayMonths: number | null;
  note: string | null;
}

/** Returns null (not a thrown ApiError) on a 404 — a private company, one
 * SEC hasn't indexed yet, or a filer whose XBRL tagging this parser can't
 * read is a normal, expected outcome, same posture as getStockQuote. */
export async function getFinancialHealth(ticker: string): Promise<FinancialHealth | null> {
  try {
    return await apiGet<FinancialHealth>(`/market/financial-health/${encodeURIComponent(ticker)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// --- Accounts (api/app/routers/auth.py) ---

export interface SignUpResponse {
  message: string;
  email: string;
  /** Only ever set when no real email delivery is configured on the
   * backend yet (ConsoleEmailProvider) — lets the app offer a "continue"
   * shortcut in dev instead of requiring a real inbox. Never set once real
   * SMTP is configured, so this can never leak a usable token in
   * production. */
  dev_verification_token: string | null;
}

export function signUp(email: string, password: string): Promise<SignUpResponse> {
  return apiPost<SignUpResponse>("/auth/signup", { email, password });
}

export interface AuthUser {
  id: string;
  email: string;
  is_verified: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export function logIn(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/auth/login", { email, password });
}

export function getMe(token: string): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me", {}, { Authorization: `Bearer ${token}` });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>("/auth/resend-verification", { email });
}

export interface RequestPasswordResetResponse {
  message: string;
  /** Dev-only escape hatch, same rationale as SignUpResponse.dev_verification_token. */
  dev_reset_token: string | null;
}

export function requestPasswordReset(email: string): Promise<RequestPasswordResetResponse> {
  return apiPost<RequestPasswordResetResponse>("/auth/request-password-reset", { email });
}

/** Reset itself happens on a web page (GET/POST /auth/reset-password) opened
 * from the email link — same pattern as email verification — so there's no
 * client function for submitting it, only for requesting the link. */

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiPost<{ message: string }>(
    "/auth/change-password",
    { current_password: currentPassword, new_password: newPassword },
    { Authorization: `Bearer ${token}` },
  );
}

export function deleteAccount(token: string, password: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(
    "/auth/me",
    { password },
    { Authorization: `Bearer ${token}` },
  );
}

// --- Companies (api/app/routers/companies.py) ---
//
// Replaces the old app/mocks/companyProfile.ts + discoveryCards.ts static
// data. Real, server-side, and updatable without an app rebuild -- see
// CompaniesContext for the shared fetch-once-and-cache layer every screen
// actually uses instead of calling these directly.

export function getCompanies(): Promise<CompanyRecord[]> {
  return apiGet<CompanyRecord[]>("/companies");
}

export function getCompany(id: string): Promise<CompanyRecord | null> {
  return apiGet<CompanyRecord>(`/companies/${encodeURIComponent(id)}`).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}
