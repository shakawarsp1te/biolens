# BioLens

**The frontier of biotechnology, explained simply — for investors who want to understand emerging biotech before it's obvious, not just be told what to buy.**

BioLens turns real ClinicalTrials.gov, PubMed, and SEC filing data into plain-language company profiles, trial interpretations, and catalyst calendars — with a hard rule running through every screen: it explains the science and the evidence, and it never tells you what to do about it. No BUY/SELL calls, no price targets, no fabricated confidence scores.

**Live demo:** _add your deployed URL here_ · **API docs:** `/docs` on the deployed backend

---

## What it actually does

- **Discover** — emerging oncology companies ranked by a deterministic *Frontier Score* (research activity, explicitly not "investment attractiveness"), with filters for stage, modality, target, and therapeutic area.
- **Auto-discovery pipeline** — finds real, newly-active, industry-sponsored trials on ClinicalTrials.gov, excludes large pharma via a maintained denylist, and drafts a new company profile grounded strictly in that company's own trial data. Every AI-drafted profile is flagged `pending review`, never presented as verified.
- **Company profiles** — a real pipeline (drug → target → modality → trial → phase), a two-sided thesis map ("what has to go right" / "what could go wrong" — deliberately monochrome, never green/red), and a live stock quote where one exists.
- **Cash runway** — computed from a company's own SEC filings (XBRL, no LLM involved), the same "BioLens calculated, never invented" discipline as everything else.
- **Catalyst calendar** — upcoming trial-readout dates, sourced straight from each trial's own ClinicalTrials.gov disclosure, never scraped or guessed.
- **Ask BioLens** — a RAG assistant scoped strictly to the facts already on the page it's asked from. No open-web fallback; it says so plainly when the evidence on hand isn't enough to answer.
- **Live search** — hits ClinicalTrials.gov and PubMed directly, no local database required.
- A real account system, watchlist (companies/drugs/targets), and a company comparison view.

## Why it's built the way it is

The product bet is that **the moat is the structured relationship graph** — Company → Drug → Target → Modality → Disease → Trial → Result — not the AI layer. The LLM only ever explains or drafts narrative text against that graph; it never computes a statistic, invents a number, or silently stands in for missing data. A few rules that hold everywhere in the codebase, not just in one place:

- Every generated claim is either sourced or explicitly labeled **BioLens calculated**.
- Confidence is always categorical (High/Moderate/Low) — never a fabricated decimal.
- A single-arm trial is never framed as beating a control.
- Mock or AI-drafted data is flagged wherever it appears, never presented as verified.

Full rule set: [`docs/PLAN.md`](docs/PLAN.md) §3. Original product spec: [`docs/BUILD_BRIEF.txt`](docs/BUILD_BRIEF.txt). Everything that's actually shipped, in order, with how each was verified: [`docs/CHECKLIST.md`](docs/CHECKLIST.md).

## Stack

| | |
|---|---|
| Mobile | React Native + Expo Router + TypeScript |
| Backend | FastAPI (Python) |
| Data | SQLite (interim store — see `docs/CHECKLIST.md` for the Postgres migration note) |
| AI | Anthropic Claude, behind a provider-agnostic `LLMProvider` abstraction — swapping vendors is a config change, not a rewrite |
| Real external data | ClinicalTrials.gov, PubMed, SEC EDGAR (XBRL), Yahoo Finance — all free, official, no scraping |
| Design | A from-scratch fintech-native design system (no default AI-generated-app tells: no Inter font, no purple gradients, no uppercase eyebrow labels) |

```
biolens/
├── app/     Expo (React Native + TypeScript) mobile app — also builds to a static web app
├── api/     FastAPI backend
├── docs/    Product brief, build plan, and a running checklist of everything shipped
├── render.yaml   One-click Render deploy config for the API
└── app/vercel.json  Vercel deploy config for the web build
```

## Run it locally

**API**
```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # works out of the box; fill in ANTHROPIC_API_KEY to enable Ask BioLens
uvicorn app.main:app --reload
```
Check `http://localhost:8000/health`. The company database seeds itself automatically on first boot — no manual setup script required.

**App**
```bash
cd app
npm install
npm start        # scan the QR code with Expo Go, press i for iOS Simulator, or w for web
```

## Deploying your own copy

1. **Backend → Render.** [render.com](https://render.com) → New → Blueprint → connect this repo. Render reads `render.yaml` and asks for a few secrets (an Anthropic API key at minimum). Free tier.
2. **Web app → Vercel.** [vercel.com](https://vercel.com) → New Project → import this repo → set **Root Directory** to `app`. Add an `EXPO_PUBLIC_API_BASE_URL` environment variable pointing at your Render URL, then deploy.

Both have generous free tiers and no credit card required to start.

## Checks

```bash
cd app && npm run lint && npm run typecheck
cd api && ruff check . && black --check . && pytest -q
```
CI runs both on every push — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
