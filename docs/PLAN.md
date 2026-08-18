# BioLens — Build Plan

> **Mission:** Help investors discover the frontier of biotechnology and understand the science behind emerging companies, therapies, and clinical-trial catalysts — with the simplicity of a consumer app, not a Bloomberg terminal.

This plan is derived from the BioLens Master Build Brief. It exists to keep implementation scoped to a **30-day, mobile-only MVP** and to prevent scope creep into the many "future version" features described in the brief.

---

## 1. What We're Building (and Not Building)

**Building:**
- iOS-first mobile app (React Native + Expo + TypeScript + Expo Router)
- FastAPI backend, PostgreSQL (Supabase acceptable), pgvector for retrieval
- Supabase Auth
- LLM provider abstraction (`LLMProvider`) — backend-only, no keys in app
- Oncology-only, ~30 seeded companies (20 emerging, 5–7 growth-stage, 5 large pharma)
- Core loop: **Discover → Understand → Evaluate → Follow → Return**

**Explicitly NOT building in V1** (see brief §77 for full list):
- Web dashboard, browser extension, desktop app
- Android-specific optimization
- Full internet-scale news/paper crawling
- Portfolio sync, brokerage integration, trading, price targets
- Social features (comments, chat rooms)
- Proprietary ML ranking/prediction models
- 10,000-company database

**Guardrail principle (§3):** BioLens is a research and interpretation tool, never a stock picker. No BUY/SELL/price targets. Ever.

---

## 2. Architecture Summary

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (Expo Go for dev, TestFlight for beta) |
| Navigation | Expo Router, 5 tabs: Home, Discover, Search, Watchlist, Profile |
| Backend | Python + FastAPI |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Vector retrieval | Postgres + pgvector (no Pinecone unless justified) |
| AI | Provider-agnostic `LLMProvider` abstraction, backend-only calls |

### Core data model (see brief §58 for full field list)
`companies → drugs → targets → indications → trials → trial_results → sources → events → analyses → watchlists`

The **moat is the structured relationship graph** (Company → Drug → Target → Modality → Disease → Trial → Endpoint → Result → Competitor → Deal), not the AI layer. AI makes the graph legible; it doesn't replace it.

---

## 3. Non-Negotiable Product Rules

These apply across every feature and every phase — violating them is a higher-priority bug than a missing feature:

1. **Never invent statistics.** If a number isn't in the source, don't generate it. Deterministic Python calculates derived numbers (e.g., ORR from raw counts); the LLM explains, never computes silently. Label `BioLens calculated` vs `Company reported`.
2. **Distinguish FACT / CALCULATED / INTERPRETATION / SPECULATION** (§42) in every generated analysis — never blur these.
3. **Never treat p<0.05 as the whole story.** Structured stats layer: endpoint type classification, primary vs. secondary/exploratory weighting, multiplicity awareness, CI display (with correct interpretation, not "95% probability the true value is in this range"), effect size vs. significance kept separate.
4. **Single-arm trials never get framed as beating a control.** Historical comparisons always carry a cross-trial-comparison caveat.
5. **Every claim needs a source.** Source hierarchy: Tier 1 (ClinicalTrials.gov, FDA, SEC, peer-reviewed/primary, company press release) > Tier 2 (reviews, databases) > Tier 3 (news — context only, never canonical for stats).
6. **Confidence is categorical** (High/Moderate/Low), never a fabricated decimal like "83.6%."
7. **"Emerging" has explicit inclusion logic** (§12) — not vibes. Frontier Score ranks *research activity*, not investment attractiveness, and must say so explicitly in-product.
8. **On-demand retrieval + aggressive caching**, not bulk ingestion. Never bulk-download PubMed/FDA/internet.
9. **Structured JSON out of the LLM, validated with Pydantic**, retry-with-repair on malformed output — never freeform prose parsed after the fact.

---

## 4. Phase Overview (maps to Day-by-day plan in brief §76)

| Phase | Days | Deliverable |
|---|---|---|
| 0 | 1–3 | Repo scaffold: Expo app, FastAPI, Postgres/Supabase, env vars, CI/lint, test infra, static mock screens (no AI yet) |
| 1 | 4–6 | Navigation shell (5 tabs) + reusable components (CompanyCard, EventCard, EvidenceBadge, SourceChip, DrugCard, TrialMetric) |
| 2 | 7–9 | DB schema + seed (10 companies, 20 drugs, 10 targets, 20 trials, verified data) + company pages |
| 3 | 10–12 | ClinicalTrials.gov integration: NCT lookup, sponsor/drug search, caching, tests |
| 4 | 13–14 | PubMed integration: targeted search only, caching, rate-limit respect |
| 5 | 15–17 | Readout ingestion pipeline: plain-text → entity extraction (company/drug/target/trial/phase/indication/stats) → JSON |
| 6 | 18–20 | Deterministic statistics parser: endpoint classification, sample-size extraction, ORR denominators, HR handling, CI validation, p-value storage, primary/secondary labeling, single-arm warnings |
| 7 | 21–22 | Interpretation prompts (fact/calc/interpretation/speculation separation) + citation mapping |
| 8 | 23–24 | Discover page: ~20 emerging companies, filters, Frontier Score + explanations |
| 9 | 25 | Watchlist (companies/drugs/targets) |
| 10 | 26 | Ask BioLens (RAG over current research package only, refuses when evidence insufficient) |
| 11 | 27 | Seed 30–50 event analyses (cold-start content) |
| 12 | 28 | User testing (~10 people, unguided) |
| 13 | 29 | Fix onboarding/comprehension issues only — no new features |
| 14 | 30 | TestFlight beta: app icon, screenshots, privacy copy, disclaimer, feedback mechanism |

Detailed task-level checklist: see `CHECKLIST.md`.

---

## 5. Seed Data (Oncology only, V1)

**Emerging/growth-stage (research candidates — verify ticker/independence/active program at seed time):**
Janux Therapeutics, Cullinan Therapeutics, Bicara Therapeutics, Nurix Therapeutics, IDEAYA Biosciences, Cardiff Oncology, Black Diamond Therapeutics, Relay Therapeutics, Tango Therapeutics, Monte Rosa Therapeutics.

**Large-pharma reference anchors:** Eli Lilly, Merck, Amgen, Roche, Bristol Myers Squibb.

**Target feed composition:** 70–80% emerging/growth-stage, 20–30% established pharma.

---

## 6. MVP Success Criteria (§78–79)

- Working mobile app, 20–30 emerging companies represented
- Users can paste clinical-trial text → structured, sourced analysis
- Important statements show sources
- Users discover companies they didn't already know
- Users can follow companies
- 10–20+ beta testers (ideally 50), 25%+ return more than once
- Key qualitative test: *"Did BioLens show you a company/therapy you'd never heard of and make you understand why it mattered?"* and *"Would understanding this without BioLens have taken significantly more research?"*

---

## 7. Explicitly Deferred (do not build until instructed)

Web frontend, automated news crawling, push notifications, broad company database expansion, immunology/metabolic/neuro/rare-disease areas, portfolio intelligence, deal tracking, private-company discovery, VC tooling. (Full list: brief §80.)

---

## 8. Working Agreements

- Read the full brief before implementing any feature.
- Prefer simple, maintainable architecture over premature abstraction.
- Tests required for data parsers and statistics logic.
- Cache all external API responses; track `last_verified_at` per record.
- LLM prompts version-controlled; model outputs stored separately from source facts.
- Mock/demo data must be clearly flagged as such — never presented as real to make a demo look complete.
- No web frontend, no new major features on Days 29–30 — polish only.
