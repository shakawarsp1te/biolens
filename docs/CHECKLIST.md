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
- [x] Build company profile page (BioLens Summary, Why It Matters, Pipeline view, Thesis Map) — now covers all four Discover companies (Janux, Cardiff, Erasca, Xencor) looked up by id, not just one profile shown regardless of which card was tapped (Aug 20, 2026 fix)

## Phase 3 — ClinicalTrials.gov Integration (Days 10–12)

- [x] NCT ID lookup
- [x] Sponsor/company search
- [x] Drug/intervention search
- [x] Cache raw API responses (in-memory `CacheStore` abstraction — Postgres-backed impl once Supabase exists)
- [x] Write tests for parsing/matching logic (41 tests; parsing tests run against real captured API fixtures, not hand-built fakes)

## Phase 4 — PubMed Integration (Days 13–14)

- [x] Targeted search by NCT ID (via PubMed's Secondary Source ID field — verified live)
- [x] Targeted search by drug name/alias
- [x] Targeted search by target + indication
- [x] Cache results (Drug Research Packages — company-level aggregation needs the live DB, so it composes per-drug packages rather than a separate concept)
- [x] Respect rate limits (3 req/sec, 10 with an API key — hit NCBI's real limit once while collecting test fixtures, which is how thoroughly this was checked)
- [x] Store only permitted metadata/abstracts — no full-text scraping of copyrighted papers

## Phase 5 — Readout Ingestion (Days 15–17)

- [x] Plain-text input endpoint (`POST /analyze/readout`) — built and running; correctly 503s until an Anthropic key exists (verified live)
- [x] Entity extraction: company, drug, target, trial/NCT ID, phase, indication (`ReadoutExtraction` model)
- [x] Structured JSON output (Pydantic-validated) — via Anthropic's native `messages.parse(output_format=...)`
- [x] Retry-with-repair on malformed model output — orchestration logic thoroughly tested against a fake provider

**Verified live** (Aug 19, 2026) — `AnthropicProvider` confirmed against the real API once a key was added. Real test: fed the model a plain-text readout mentioning Cardiff Oncology/onvansertib/NCT06106308 but *not* its target; it correctly extracted everything stated and left `target: null` with a note explaining why, rather than filling it in from its own knowledge of onvansertib. That's the "never invent" instruction actually holding under a real call, not just in a mocked test.

## Phase 6 — Deterministic Statistics Parser (Days 18–20)

- [x] Endpoint type classifier (time-to-event / binary / continuous)
- [x] Sample size + evaluable-population extraction
- [x] ORR denominator display (never % alone) — refuses to back-calculate responders from a percentage + sample size when the source doesn't state the fraction explicitly (real case caught: the CRDF-004 abstract gives 26.4% and n=53 but never "14 of 53")
- [x] HR handling with correct plain-language framing (no "% of patients saved")
- [x] CI parsing + validation (no "95% probability" misstatement) — handles both numeric and "not reached" upper bounds
- [x] P-value storage, no automatic p<0.05 = success framing
- [x] Primary vs. secondary vs. exploratory endpoint labeling
- [x] Single-arm trial warning logic
- [x] Interim-analysis threshold handling (never default to 0.05 blindly)
- [x] Unit tests for every parser function above (53 new tests, several run against the real Cardiff Oncology CRDF-004 trial abstract fetched live in Phase 4, not just synthetic strings)

## Phase 7 — Interpretation Layer (Days 21–22)

- [x] LLM prompt returns FACT / CALCULATED / INTERPRETATION / SPECULATION separately — FACT/CALCULATED are passed through from Phase 5/6's deterministic output, never generated by the model itself; only INTERPRETATION/SPECULATION come from the LLM call
- [x] Citation mapping: each claim → source_id(s)
- [x] Confidence labeling (categorical only)
- [x] Evidence classification: Confirmatory Positive / Encouraging Signal / Inconclusive / Negative on Primary Endpoint — built as a **deterministic** rule-based classifier (BUILD_BRIEF.txt §41: "deterministic before LLM"), not an LLM judgment call; fully tested, no external dependency

**Verified live** (Aug 19, 2026) — real call produced properly-separated, well-hedged INTERPRETATION and SPECULATION claims (14 total) on a real Cardiff Oncology readout, every one categorically confidence-labeled, cited, and free of investment language; `evidence_classification` came back `inconclusive`, correctly, since `primary_endpoint_met` wasn't supplied.

## Phase 8 — Discover (Days 23–24)

- [x] Transparent inclusion logic — `classify_maturity()` implements §12's exact Emerging/Scaling/Established criteria as a deterministic function, fully tested
- [x] Seed ~20 emerging companies — 10 real, WebSearch-verified companies as of Aug 20, 2026 (see "Move company data to a real backend store" below), now growing on its own via the auto-discovery pipeline (typically 13+ after one pass — see "Auto-discovery pipeline" below). Not manually pushed to exactly 20 since the discovery pipeline is now the intended long-term way this number grows, not another one-off manual research pass.
- [x] Filters: Therapeutic Area, Stage, Modality, Target (searchable), Company Maturity — `apply_discover_filters()` built and tested on the backend, and as of Aug 20, 2026 all four (Therapeutic Area, Stage, Modality, Target) are wired to real interactive pill UI on Discover (`utils/discoverFilters.ts` mirrors the Python match rules exactly, verified in-browser: selecting "Phase II" correctly narrows to Cardiff Oncology, selecting "KRAS" correctly narrows to Erasca, selecting a specific modality correctly narrows to the one matching company). Therapeutic Area only has one real option today since every seed company is oncology-focused. Company Maturity has no pill yet.
- [x] Frontier Score calculation (Clinical Momentum 30% / Scientific Novelty 20% / Evidence Maturity 20% / Catalyst Activity 15% / Strategic Validation 15%) — exact weights verified by isolating each component
- [x] Frontier Score explanation copy ("ranks research activity, not investment attractiveness") — identical copy on both API and mobile app
- [x] Discovery card component — matches BUILD_BRIEF.txt §54 field-for-field (including its own Cardiff Oncology worked example, used verbatim as mock data); visually verified in-browser

## Phase 9 — Watchlist (Day 25)

- [x] Follow/unfollow companies — `WatchButton` wired into `DiscoveryCard`, shared `WatchlistContext` keeps Discover and Watchlist in sync live
- [x] Follow/unfollow drugs — `WatchButton` wired into `DrugCard` and each `PipelineAssetRow`'s drug (Aug 20, 2026); Watchlist resolves followed drugs via `utils/pipelineLookup.ts`
- [x] Follow/unfollow targets — `WatchButton` wired into each `PipelineAssetRow`'s target (Aug 20, 2026); a target's entityId is the target string itself, so following it represents following that biology across every company, not one asset
- [x] Persist to `watchlists` table — persisted to AsyncStorage (device-local) in the exact shape of the real `watchlists` table (`entity_type`, `entity_id`); genuine persistence, verified surviving a full page reload, not an in-memory stub. Swapping to the real Supabase-backed table later is a storage-layer change in `app/services/watchlist.ts` only, not a data-model or UI change — needs Phase 0's Supabase Auth to exist first, since cross-device sync needs an account.

## Phase 10 — Ask BioLens (Day 26)

- [x] RAG scoped strictly to current research package (no open-web fallback) — `ask_biolens()` builds its prompt only from the caller's `facts`/`calculated`/`source_ids`; the system prompt instructs "never your own general knowledge," and `_validate_citations()` catches the one concretely-checkable failure mode (citing a `source_id` outside the given package) with a retry-with-repair loop, same pattern as Phases 6/7/9
- [x] Explicit "not enough verified information" fallback response — exact required sentence (`INSUFFICIENT_EVIDENCE_MESSAGE`), never trusted to the model's own wording: substituted verbatim by the service whenever `has_sufficient_evidence` is false, and an empty research package short-circuits to it deterministically before any LLM call is made at all (§41 "deterministic before LLM")
- [x] No hallucinated gap-filling — same fabricated-citation retry-with-repair as above; `AskBioLensError` raised (→ 422) if the model still can't stay inside the given sources after `max_repair_attempts`

Backend: `api/app/services/ask_biolens.py`, `POST /analyze/ask` (`api/app/routers/ask.py`), 16 tests (9 service + router-level 6, plus the request-model validation test) all passing against a `FakeLLMProvider`.

Mobile: `AskBioLensBox` (question input + 3 example-question chips + loading/error/answer states) now lives at the bottom of every company profile screen. `utils/askBiolensContext.ts` builds the `facts`/`source_ids` package from that company's own profile data (BioLens Summary, Why It Matters, each pipeline asset's target/modality/disease/stage/trial IDs) — so each company's Ask BioLens is grounded in that company's own page, not a shared pool.

**Verified live** (Aug 20, 2026) — real end-to-end run against Cardiff Oncology's profile with a real `uvicorn` backend + Expo web preview, real `ANTHROPIC_API_KEY`, no mocking: asking "How strong is this trial?" returned a thoughtful, correctly-hedged answer citing `NCT06106308` (the trial's real source ID) and explicitly noting the profile is mock data; asking "Who is the CEO of Cardiff Oncology?" — a real question the given package can't answer — correctly triggered the exact required insufficient-evidence sentence rather than guessing. Both responses confirmed rendering in their distinct UI states via screenshot.

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

## Beyond the checklist (not tied to a numbered phase)

- [x] Visual redesign, Robinhood-inspired (Aug 20, 2026) — new theme system (near-black canvas, big bold "hero" numbers, pill-based chips instead of bordered boxes, disciplined single accent color — kept blue, deliberately never green, so a hero number can never read as "the stock is up"). Applied across every screen and component. Verified in-browser at multiple viewport sizes before committing.
- [x] Live Search (Aug 20, 2026) — the Search tab (previously a Phase-0 placeholder) now hits the real ClinicalTrials.gov and PubMed APIs directly and shows real results, with no seed database required. `app/services/api.ts` is a typed client; `utils/discoverFilters.ts`-style parity with the backend keeps behavior identical to what a future `companies`/`drugs`-table-backed search would do. Verified live end-to-end: searching "onvansertib" against a locally-running backend returned 10 real trials (correct NCT IDs, phases, sponsors, statuses) and 5 real PubMed papers.
- [x] Ask BioLens, Phase 10 (Aug 20, 2026) — see its own Phase 10 section above.
- [x] Typographic identity + wordmark (Aug 20, 2026) — Space Grotesk (headlines, hero numbers) and JetBrains Mono (tabular prices/stats) replace the platform default sans everywhere, loaded via `useFonts()` gating the root layout (`app/app/_layout.tsx`); a small custom mark (`Wordmark.tsx`, three ascending bars in a rounded tile — no image asset) gives the app one deliberate brand moment on its Home/"Frontier" front door instead of being repeated on every tab. Aimed squarely at the app not reading as a generic, unbranded scaffold.
- [x] Real stock price for publicly traded companies (Aug 20, 2026) — `GET /market/quote/{ticker}` (`api/app/services/market_data.py`, `api/app/routers/market.py`) pulls a live quote from Yahoo Finance's public (unofficial, no-key) chart endpoint, 60s-cached, gracefully returning "no quote available" rather than an error on a bad ticker or upstream hiccup. Shown as `StockQuoteCard` on each company's profile (only when that company has a ticker) — price, change, %, exchange — explicitly labeled "Market data only — not investment advice" and never paired with buy/sell/price-target language, same discipline as everywhere else in BioLens. 7 tests (client + router) passing. Verified live: real prices for CRDF ($0.91) and XNCR ($27.00) rendered correctly in-browser, colored by real gain/loss (a deliberate, documented exception to the app's no-green/red-semantics rule, since this is factual price movement, not a BioLens recommendation).
- [x] Search suggestions (Aug 20, 2026) — focusing the Search tab's input now shows a "Try searching" row of real example queries drawn from BioLens's own seed companies, plus a session-local "Recent" row of the user's last 5 searches; tapping either fills the box and runs the search immediately. Verified live: focusing the empty box showed suggestions, tapping "onvansertib" returned the same 10 real trials as typing it manually, and refocusing afterward showed it under "Recent".
- [x] Interactive price charts (Aug 20, 2026) — `GET /market/history/{ticker}?range=` (1D/1W/1M/3M/1Y, backed by the same Yahoo chart endpoint as the quote, 5-minute cached) feeds a self-built SVG line chart (`PriceChart.tsx`, react-native-svg + core RN `PanResponder` — no gesture-handler dependency). Dragging scrubs a crosshair that reveals the exact price and date at that point; a plain tap (not a drag — disambiguated by total finger displacement) opens a full detailed view (`app/app/stock-detail.tsx`, a modal route) with its own bigger chart, a range picker, and a day/52-week/volume/exchange stat grid. Same component powers both the compact card sparkline and the detail screen. 3 new backend tests for `get_history`'s parsing/caching/range-validation, plus 5 router tests. Verified live end-to-end: all 5 ranges returned real CRDF price history; dragging across the compact chart showed a live "$0.99 · Aug 7"-style tooltip that tracked the cursor; a 400px drag correctly did *not* navigate away, while tapping opened the detail modal; switching to 1Y there rendered a full real year of data, correctly recolored red for the period's net decline.
- [x] Account system (Aug 20, 2026) — sign-up/email-verification/login, standing in for Supabase Auth (already assumed by `db/migrations/0001_init_schema.sql`'s `watchlists.user_id -> auth.users` foreign key) until that's provisioned. Backend: `api/app/services/password_policy.py` (deterministic complexity rules — 10+ chars, upper/lower/digit/special, a small common-password denylist, can't contain your own email), `user_store.py` (SQLite via aiosqlite, shaped to migrate to Postgres/Supabase Auth cleanly later), `email.py` (an `EmailProvider` abstraction mirroring `LLMProvider` exactly — `ConsoleEmailProvider` logs the verification email, including its link, until real SMTP credentials are configured; `SMTPEmailProvider` activates the moment they are, same pattern as `AnthropicProvider`), `auth.py` (bcrypt hashing, JWT sessions via PyJWT), and `routers/auth.py` (`POST /auth/signup`, `GET /auth/verify` — an HTML page meant to be opened from an email client, `POST /auth/login`, `POST /auth/resend-verification`, `GET /auth/me`). Mobile: `AuthContext` (mirrors `WatchlistContext`'s shape), `expo-secure-store`-backed token storage (falls back to AsyncStorage on web, where SecureStore's native module doesn't exist), a live password-strength checklist (`PasswordStrengthMeter.tsx`, mirroring the backend's exact rules in `utils/passwordPolicy.ts`) on a dedicated Sign Up page, a Log In page with a "resend verification" path for an unverified account, and the Profile tab now showing real signed-in/signed-out state. 32 new backend tests (password policy + service + router). Verified live end-to-end in-browser: weak password correctly disabled the submit button and showed the exact failing rules; a strong password enabled it; signup succeeded and — since no real SMTP is configured yet — surfaced an explicit "development mode" notice rather than pretending an email was delivered; tapping its link opened the real `GET /auth/verify` page and showed the real success HTML; logging in afterward landed on Profile showing "✓ Verified"; the session survived a full page reload; logging out correctly reverted to the signed-out state. Real email delivery just needs SMTP credentials in `api/.env` (`smtp_host`/`smtp_username`/`smtp_password`) — no code change.
- [x] Account system completeness — forgot/reset password, change password, delete account (Aug 20, 2026) — extends the above: `POST /auth/request-password-reset` (same anti-enumeration shape as resend-verification) + `GET`/`POST /auth/reset-password` (a self-contained HTML form page, opened from the emailed link, same "browser handles it" pattern as verification), `POST /auth/change-password` and `DELETE /auth/me` (both bearer-authenticated, both requiring the current password as a second factor). Mobile: Forgot Password, Change Password, and Delete Account screens (the last requires typing "DELETE" *and* the password before the button enables — two independent confirmations for an irreversible action). 12 new service tests + 15 new router tests. Verified live end-to-end via curl (full chain: signup → verify → request reset → open the real reset form → submit a new password → old password now rejected, new one works → change password again → old-of-old rejected → delete account with the wrong password rejected, then the right password succeeds → login afterward correctly 401s) and in-browser for the Forgot Password screen (correctly silent for an already-deleted test account, correctly showed the dev-mode reset link for a real one, and the link opened the actual reset form).
- [x] Follow drugs and targets (Aug 20, 2026) — closes the Phase 9 gap noted above. `WatchButton` (already generic across `entityType`) is now wired into `DrugCard` and into each `PipelineAssetRow` (both its drug and its target — a target's `entityId` is the target string itself, e.g. "PLK1", so following it once represents following that biology across every company, not one asset). Watchlist's Drugs and Targets sections (previously always empty) now resolve followed entries via `utils/pipelineLookup.ts`, which flattens every company profile's pipeline into one lookup table — there's no standalone `drugs`/`targets` table yet, so a company's own profile is the only source of truth for what a drug or target even is. Verified live: followed Cardiff's Onvansertib and its PLK1 target from the company profile screen, confirmed both showed up correctly on Watchlist with the right company/modality/stage metadata and a working link back to the company.
- [x] Therapeutic Area + Modality filters on Discover (Aug 20, 2026) — closes the Phase 8 gap noted above. Both use the exact same `apply_discover_filters`/`applyDiscoverFilters` match rules Stage and Target already used; Modality (6 distinct real values across the 4 seed companies) is genuinely useful today, Therapeutic Area has only one real option (every seed company is oncology-focused) but is wired up honestly rather than faked, with a footnote explaining why. Verified live: selecting "PLK1 inhibitor (small molecule)" correctly narrowed Discover to Cardiff Oncology alone.
- [x] "New since your last visit" badges on Watchlist (Aug 20, 2026) — a real diff against live ClinicalTrials.gov results, not a fabricated notification. `utils/watchlistFreshness.ts` stores each followed company's last-seen set of NCT IDs (AsyncStorage) and compares it against a fresh sponsor-search lookup every time Watchlist loads; a company's first-ever visit sets the baseline with nothing reported as new (trials that existed before you started following were never "new" to begin with), and the visit that computes a diff also becomes the new baseline for next time. Verified live: real baseline recorded (10 real NCT IDs for Cardiff Oncology); manually truncating the stored baseline to simulate 7 unseen trials correctly showed "7 new trials since your last visit" on reload, and reloading again afterward correctly showed nothing (baseline had updated).
- [x] Company comparison view (Aug 20, 2026) — `app/app/compare.tsx`, reachable from a "Compare two companies" link on Discover. A spec-table layout (not two side-by-side cards, which don't fit legibly at phone width) showing Frontier Score, stage, maturity, confidence, pipeline-asset count, primary focus, one-sentence summary, and key risk for any two of the four companies with a full profile, plus the same Frontier Score disclaimer shown everywhere else it appears. Verified live: compared Cardiff Oncology (Frontier Score 81) against Janux Therapeutics (61) and confirmed every row and both "Open ―" buttons.
- [x] Move company data to a real backend store (Aug 23, 2026) — the actual prerequisite for "constantly update/create profiles": data baked into the mobile app bundle (the old `app/mocks/companyProfile.ts`/`discoveryCards.ts`) can never update without a new app release. `api/app/services/company_store.py` (SQLite via aiosqlite, same interim-store pattern as `user_store.py`) plus `GET /companies`/`GET /companies/{id}` (`api/app/routers/companies.py`) now serve every company; `CompaniesContext` fetches once and shares it across Discover, Watchlist, Compare, the company profile screen, and `utils/pipelineLookup.ts`. Response shape matches `app/types/domain.ts`'s existing `DiscoveryCardData`/`CompanyProfile` types field-for-field, so every existing, already-tested component needed zero changes. Expanded from 4 fully-built companies to 10: the original 4 transcribed verbatim, plus full profiles researched fresh for the 6 that Phase 2 had already verified as real but never fully built out (IDEAYA, Relay, Nuvation Bio, Kura Oncology, Zentalis, Arvinas) — including Arvinas's vepdegestrant, confirmed via a follow-up search to be the first-ever FDA-approved PROTAC degrader (approved May 2026, ahead of its June PDUFA date). 20 new backend tests. Verified live: all 10 companies and all 12 real pipeline drugs render on Discover; Compare and Watchlist both work against the live list.
- [x] Auto-discovery pipeline (Aug 23, 2026) — `api/app/services/discovery.py`, exposed as `POST /companies/discover` and `python -m scripts.run_discovery`. Finds real, recently-updated, industry-sponsored oncology trials on ClinicalTrials.gov (`LeadSponsorClass=INDUSTRY` — CT.gov's own classification, not a keyword guess, so it reliably excludes universities/hospitals/government sponsors), filters out companies BioLens already tracks and a denylist of ~35 well-known large pharma (the point is surfacing smaller/emerging companies specifically, per the brief's own goal of exposing "new and upcoming discoveries by smaller companies"), then has an LLM draft a profile strictly grounded in that company's real trial data alone — same "deterministic before LLM" shape as every other service in this codebase: which sponsors are candidates, which trials belong to them, and the Frontier Score are all plain-Python computation from real CT.gov metadata; the LLM only drafts narrative fields, validated afterward (categorical confidence, exact stage/maturity strings, no investment language, no trial ID that wasn't actually given to it) with the same retry-with-repair pattern as `ask_biolens.py`. Every auto-discovered profile is stored `reviewStatus="ai_drafted_unreviewed"` and shown with a distinct `AiDraftFlag` badge on the mobile app (not the same as `MockDataFlag`, which means something different) — PLAN.md Phase 11's "manually review each for accuracy before publishing" rule, enforced as a stored field instead of a step nobody can verify happened. 20 new tests. Verified live end-to-end with the real backend, real ClinicalTrials.gov, and the real LLM: a real pass found three genuinely new, previously-untracked companies (Mabwell (Shanghai) Bioscience, Zai Lab (Shanghai), and CERo Therapeutics Holdings — the last a single-asset, single-trial cell-therapy company, exactly the kind of small/emerging discovery this is meant to surface), and the drafted CERo profile correctly hedged everything the given trial data didn't specify (target, construct, cell source) rather than inventing it. This first live run also caught and fixed a real bug: the LLM's first attempt wrote "Phase 1" and a free-text maturity description instead of the app's required exact strings ("Phase I", "emerging"/"scaling"/"established") — added explicit validation for both, confirmed fixed by re-running the same live pass afterward. On "constantly": this session can't run a permanent background daemon, so recurring execution needs either a real deployment's cron/scheduled function calling `scripts/run_discovery.py`, or asking Claude Code to re-run it periodically in a future session — the pipeline itself is real and complete; the scheduling wrapper around it is a deployment decision, not something built here.
- [x] Second visual redesign pass, fintech-native (Aug 25, 2026) — the Aug 20 redesign above still read as an obviously AI-generated layout: uppercase "eyebrow" labels above headings, boxed cards everywhere (each list item its own bordered/rounded box), a tan/beige notice-box color reused for every warning and error, and a repeating 4-cell stat grid on the stock detail screen. This pass, explicitly modeled on Robinhood, removes all four: `typography.label` (sentence-case, no letter-spacing) replaces every uppercase caption used as a section eyebrow; a new `ListContainer`/`Divider` pair (one rounded surface, hairline rules between rows) replaces individually-boxed rows across Discover (companies/drugs/trial data), Watchlist, Search results, and the stock detail stat block; a new accordion `FilterBar` replaces four separately-labeled stacked filter rows with one scrollable chip strip; a new `Callout` component (a left-border accent line, no filled background) replaces the `colors.mockDataBanner` tan box previously reused for every notice/warning/error across all 4 auth screens and `AskBioLensBox`'s low-confidence answers — `mockDataBanner` itself was then deleted from the theme as fully dead. The company profile screen (`app/company/[id].tsx`) was restructured from a stack of identically-boxed "Section" components into a flowing document (lead paragraph, a `Key risk` left-border callout, plain bullet lists, `Pipeline` in a `ListContainer`, `Thesis map` as the one deliberately card-styled module since it's genuinely singular). `DiscoveryCard` was cut down to a scannable row (name, one line of context, trailing Frontier Score) with the fuller "why it surfaced"/"key risk" detail moved to the profile page instead of repeated on every list row. `MockDataFlag`/`AiDraftFlag` became inline colored text instead of standalone pill banners. No underlying data, scoring, or backend logic touched — verified unchanged (324 backend tests still passing). Verified live in-browser across every screen (Home, Discover incl. the FilterBar accordion, a company profile incl. `ThesisMap`'s two-column layout at real ~400px width, Watchlist empty + populated, Search results, Compare, Profile, stock detail, and all 4 auth screens); `tsc --noEmit` and `eslint .` both clean throughout.

---

## Cross-cutting (apply throughout, not a phase)

- [ ] No BUY/SELL/price-target language anywhere in copy or model output
- [ ] Every generated numeric claim traceable to a source or marked "BioLens calculated"
- [ ] `LLMProvider` abstraction — zero hardcoded vendor coupling
- [ ] No API keys ever shipped in the mobile bundle
- [ ] Mock/demo data clearly flagged wherever it appears
