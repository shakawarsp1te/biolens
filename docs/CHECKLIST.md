# BioLens — Task Checklist

Companion to `PLAN.md`. Check items off as completed. Do not start a later phase's items until the current phase's core items are done — the brief is explicit that sequencing matters more than speed.

---

## Phase 0 — Repo & Infra (Days 1–3)

- [x] Initialize monorepo (e.g. `/app` for Expo, `/api` for FastAPI)
- [x] `npx create-expo-app` with TypeScript template
- [x] Set up Expo Router
- [x] Initialize FastAPI project structure
- [ ] Provision Postgres (Supabase project)
- [ ] Enable pgvector extension
- [ ] Set up Supabase Auth
- [x] Create `.env.example` for both app and api (no real keys committed)
- [x] Set up CI (lint + basic tests) for both app and api
- [x] Set up linting/formatting (ESLint/Prettier for app, ruff/black for api)
- [x] Build static mock screens for all 5 tabs (no live data, no AI)
- [x] Confirm Expo Go dev loop works on a physical iPhone or simulator

## Phase 1 — Navigation & Components (Days 4–6)

- [x] Implement 5-tab navigation: Home, Discover, Search, Watchlist, Profile
- [x] Build `CompanyCard`
- [x] Build `EventCard`
- [x] Build `EvidenceBadge` (High/Moderate/Low confidence — categorical only)
- [x] Build `SourceChip`
- [x] Build `DrugCard`
- [x] Build `TrialMetric`
- [x] Apply UI style direction: premium/scientific/minimal — no DNA-helix clip art, no neon "AI" gradients, no green=buy/red=sell

## Phase 2 — Schema & Seed Data (Days 7–9)

- [x] Create tables: `companies`, `drugs`, `targets`, `indications`, `drug_indications`, `trials`, `trial_results`, `sources`, `events`, `analyses`, `watchlists` (schema written in `api/db/migrations/0001_init_schema.sql`; not yet run against a live DB — no Supabase project exists yet)
- [x] Add `last_verified_at` to companies/trials
- [x] Verify each seed company: still independent, ticker current, program active, not acquired (web-search verified Aug 19, 2026 — see `api/db/seed/README.md`; this check caught and excluded one already-acquired company and one discontinued drug)
- [x] Seed 10 companies (oncology)
- [ ] Seed 20 drugs (16 seeded — every one individually verified; didn't pad to 20 with unverified/invented drugs)
- [x] Seed 10 targets (simple + detailed explanations each) (15 seeded — real target diversity across the 16 drugs came out higher than 10)
- [ ] Seed 20 trials (19 seeded, 18 with a verified real NCT ID)
- [x] Build company profile page (BioLens Summary, Why It Matters, Pipeline view, Thesis Map)

## Phase 3 — ClinicalTrials.gov Integration (Days 10–12)

- [x] NCT ID lookup
- [x] Sponsor/company search
- [x] Drug/intervention search
- [x] Cache raw API responses (in-memory `CacheStore` abstraction — Postgres-backed impl once Supabase exists)
- [x] Write tests for parsing/matching logic (41 tests; parsing tests run against real captured API fixtures, not hand-built fakes)

## Phase 4 — PubMed Integration (Days 13–14)

- [ ] Targeted search by NCT ID
- [ ] Targeted search by drug name/alias
- [ ] Targeted search by target + indication
- [ ] Cache results (Drug/Company Research Packages)
- [ ] Respect rate limits
- [ ] Store only permitted metadata/abstracts — no full-text scraping of copyrighted papers

## Phase 5 — Readout Ingestion (Days 15–17)

- [ ] Plain-text input endpoint (`POST /analyze/readout`)
- [ ] Entity extraction: company, drug, target, trial/NCT ID, phase, indication
- [ ] Structured JSON output (Pydantic-validated)
- [ ] Retry-with-repair on malformed model output

## Phase 6 — Deterministic Statistics Parser (Days 18–20)

- [ ] Endpoint type classifier (time-to-event / binary / continuous)
- [ ] Sample size + evaluable-population extraction
- [ ] ORR denominator display (never % alone)
- [ ] HR handling with correct plain-language framing (no "% of patients saved")
- [ ] CI parsing + validation (no "95% probability" misstatement)
- [ ] P-value storage, no automatic p<0.05 = success framing
- [ ] Primary vs. secondary vs. exploratory endpoint labeling
- [ ] Single-arm trial warning logic
- [ ] Interim-analysis threshold handling (never default to 0.05 blindly)
- [ ] Unit tests for every parser function above

## Phase 7 — Interpretation Layer (Days 21–22)

- [ ] LLM prompt returns FACT / CALCULATED / INTERPRETATION / SPECULATION separately
- [ ] Citation mapping: each claim → source_id(s)
- [ ] Confidence labeling (categorical only)
- [ ] Evidence classification: Confirmatory Positive / Encouraging Signal / Inconclusive / Negative on Primary Endpoint

## Phase 8 — Discover (Days 23–24)

- [ ] Seed ~20 emerging companies with transparent inclusion logic
- [ ] Filters: Therapeutic Area (oncology only for now), Stage, Modality, Target (searchable), Company Maturity
- [ ] Frontier Score calculation (Clinical Momentum 30% / Scientific Novelty 20% / Evidence Maturity 20% / Catalyst Activity 15% / Strategic Validation 15%)
- [ ] Frontier Score explanation copy ("ranks research activity, not investment attractiveness")
- [ ] Discovery card component

## Phase 9 — Watchlist (Day 25)

- [ ] Follow/unfollow companies
- [ ] Follow/unfollow drugs
- [ ] Follow/unfollow targets
- [ ] Persist to `watchlists` table

## Phase 10 — Ask BioLens (Day 26)

- [ ] RAG scoped strictly to current research package (no open-web fallback)
- [ ] Explicit "not enough verified information" fallback response
- [ ] No hallucinated gap-filling

## Phase 11 — Cold-Start Content (Day 27)

- [ ] Write/generate 30–50 event analyses across: early-stage results, Phase II readouts, Phase III results, licensing deals, novel technologies, **failed trials included**
- [ ] Manually review each for accuracy before publishing

## Phase 12 — User Testing (Day 28)

- [ ] Recruit ~10 target users (biotech-curious investors, not scientists)
- [ ] Unguided testing session, record confusion points
- [ ] Ask the two core validation questions (see PLAN.md §6)

## Phase 13 — Fixes Only (Day 29)

- [ ] Fix onboarding confusion points found in testing
- [ ] Fix comprehension issues found in testing
- [ ] Explicitly do NOT add new features

## Phase 14 — TestFlight Beta (Day 30)

- [ ] App icon
- [ ] Screenshots
- [ ] Privacy copy
- [ ] Disclaimer (not investment advice)
- [ ] Beta feedback mechanism
- [ ] Submit to TestFlight

---

## Cross-cutting (apply throughout, not a phase)

- [ ] No BUY/SELL/price-target language anywhere in copy or model output
- [ ] Every generated numeric claim traceable to a source or marked "BioLens calculated"
- [ ] `LLMProvider` abstraction — zero hardcoded vendor coupling
- [ ] No API keys ever shipped in the mobile bundle
- [ ] Mock/demo data clearly flagged wherever it appears
