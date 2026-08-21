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
- [ ] Seed ~20 emerging companies — still only the 10 real companies from Phase 2. Expanding to ~20 needs another real-research pass (same rigor as Phase 2's), not done this session — flagged rather than padded
- [x] Filters: Therapeutic Area, Stage, Modality, Target (searchable), Company Maturity — `apply_discover_filters()` built and tested on the backend. Stage and Target are now wired to real interactive pill UI on Discover (`utils/discoverFilters.ts` mirrors the Python match rules exactly, verified in-browser: selecting "Phase II" correctly narrows to Cardiff Oncology, selecting "KRAS" correctly narrows to Erasca). Therapeutic Area and Modality use the same logic but have no pills yet — not worth adding until there's more than one therapeutic area or a wider modality spread to filter across.
- [x] Frontier Score calculation (Clinical Momentum 30% / Scientific Novelty 20% / Evidence Maturity 20% / Catalyst Activity 15% / Strategic Validation 15%) — exact weights verified by isolating each component
- [x] Frontier Score explanation copy ("ranks research activity, not investment attractiveness") — identical copy on both API and mobile app
- [x] Discovery card component — matches BUILD_BRIEF.txt §54 field-for-field (including its own Cardiff Oncology worked example, used verbatim as mock data); visually verified in-browser

## Phase 9 — Watchlist (Day 25)

- [x] Follow/unfollow companies — `WatchButton` wired into `DiscoveryCard`, shared `WatchlistContext` keeps Discover and Watchlist in sync live
- [ ] Follow/unfollow drugs — same `WatchButton`/service supports `entityType: "drug"` already; no drug-level card has the button wired in yet
- [ ] Follow/unfollow targets — same gap as drugs
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

---

## Cross-cutting (apply throughout, not a phase)

- [ ] No BUY/SELL/price-target language anywhere in copy or model output
- [ ] Every generated numeric claim traceable to a source or marked "BioLens calculated"
- [ ] `LLMProvider` abstraction — zero hardcoded vendor coupling
- [ ] No API keys ever shipped in the mobile bundle
- [ ] Mock/demo data clearly flagged wherever it appears
