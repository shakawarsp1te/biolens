# BioLens

The frontier of biotech, explained. Full product spec: [`docs/BUILD_BRIEF.txt`](docs/BUILD_BRIEF.txt). Build plan and rules: [`docs/PLAN.md`](docs/PLAN.md). Full task checklist: [`docs/CHECKLIST.md`](docs/CHECKLIST.md).

```
biolens/
├── app/    Expo (React Native + TypeScript) iOS-first mobile app
├── api/    FastAPI backend
└── docs/   Product brief, plan, checklist
```

## Status

Phase 0 scaffold is done: Expo Router app with 5 static mock tabs (Home, Discover, Search, Watchlist, Profile), FastAPI backend with a `/health` route and the `LLMProvider` abstraction stub, lint/format/typecheck configured on both sides, CI wired up. No live data, no real accounts wired up yet — that's today's remaining to-do below.

## Do these today (can't be done from here — need your accounts)

1. **Create a GitHub repo** and push this folder to it.
   ```
   git init
   git add .
   git commit -m "BioLens: Phase 0 scaffold"
   git branch -M main
   git remote add origin <your-new-repo-url>
   git push -u origin main
   ```
2. **Create a Supabase project** (supabase.com, free tier is fine).
   - In the SQL editor, run `create extension if not exists vector;` to enable pgvector.
   - Copy the Project URL + anon key into `app/.env.local` (copy from `app/.env.example`).
   - Copy the Project URL + service role key into `api/.env` (copy from `api/.env.example`).
3. **Get an Anthropic (or your chosen LLM provider) API key** and put it in `api/.env`. Not needed until Phase 5, but grab it now while you're doing the rest.
4. **Install Expo Go** on your iPhone from the App Store, or have Xcode + iOS Simulator ready.
5. (Later — not needed for a while) An Apple Developer account, for TestFlight at the end of Phase 14.

## Run it locally

**App:**
```
cd app
npm install
npm start
```
Scan the QR code with Expo Go, or press `i` for the iOS Simulator.

**API:**
```
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill in Supabase + LLM keys once you have them
uvicorn app.main:app --reload
```
Check `http://localhost:8000/health`.

## Checks

```
cd app && npm run lint && npm run typecheck
cd api && ruff check . && black --check . && pytest -q
```

## Non-negotiable product rules (see PLAN.md §3 for the full list)

Never a stock picker — no BUY/SELL/price targets. Every generated numeric claim is either sourced or labeled "BioLens calculated." Confidence is always categorical (High/Moderate/Low), never a fabricated decimal. Mock/demo data is always flagged as such.
