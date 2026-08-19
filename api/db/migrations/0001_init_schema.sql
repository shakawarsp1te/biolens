-- BioLens — Phase 2 initial schema.
-- Run this in the Supabase SQL editor (after `create extension if not exists vector;`
-- from the Phase 0 setup, which this repeats defensively).
--
-- Design notes (see docs/PLAN.md and docs/BUILD_BRIEF.txt for the rules these
-- encode):
--   * companies/trials carry last_verified_at — the brief requires re-checking
--     that a seed company is still independent, its ticker is current, its
--     program is active, and it hasn't been acquired.
--   * confidence / evidence_classification / endpoint_role columns are all
--     constrained to fixed categorical values — never a free-form numeric
--     "confidence score" column exists anywhere in this schema.
--   * trial_results never stores a bare ORR percentage — responders and
--     evaluable are both required together so the UI can always show
--     "N of M evaluable patients" (BUILD_BRIEF.txt §34).
--   * is_mock_data flags exist wherever seed/demo content can appear, so the
--     mobile app can always render MockDataFlag correctly from live data too.

create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table if not exists targets (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    simple_explanation text not null,
    detailed_explanation text not null,
    created_at timestamptz not null default now()
);

create table if not exists indications (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists sources (
    id uuid primary key default uuid_generate_v4(),
    -- Mirrors app/types/domain.ts SourceType. "biolens_calculated" covers any
    -- number BioLens derived itself rather than read from a primary source.
    type text not null check (
        type in ('clinicaltrials_gov', 'pubmed', 'press_release', 'sec_filing', 'conference', 'biolens_calculated')
    ),
    label text not null,
    url text,
    external_id text,
    -- Raw cached API response (Phase 3/4 ClinicalTrials.gov / PubMed caching).
    cached_payload jsonb,
    fetched_at timestamptz,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------

create table if not exists companies (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    -- Reference only. Never paired with buy/sell language anywhere BioLens
    -- renders this column — see PLAN.md §3.
    ticker text,
    stage text not null,
    therapeutic_area text not null,
    one_liner text not null,
    -- 0-100, computed by the Phase 8 Frontier Score model. Null until scored.
    frontier_score smallint check (frontier_score between 0 and 100),
    is_mock_data boolean not null default false,
    -- Re-verified per BUILD_BRIEF.txt §Phase 2: still independent, ticker
    -- current, program active, not acquired.
    last_verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index if not exists companies_ticker_key on companies (ticker) where ticker is not null;

create table if not exists drugs (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references companies (id) on delete cascade,
    name text not null,
    target_id uuid references targets (id) on delete set null,
    modality text not null,
    -- Same categorical phases as app/types/domain.ts TrialPhase.
    phase text not null check (
        phase in ('Preclinical', 'Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', 'Phase III', 'Approved')
    ),
    one_liner text not null,
    -- Categorical only — see EvidenceBadge. Never a fabricated probability.
    confidence text not null default 'low' check (confidence in ('high', 'moderate', 'low')),
    is_mock_data boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists drugs_company_id_idx on drugs (company_id);
create index if not exists drugs_target_id_idx on drugs (target_id);

create table if not exists drug_indications (
    drug_id uuid not null references drugs (id) on delete cascade,
    indication_id uuid not null references indications (id) on delete cascade,
    primary key (drug_id, indication_id)
);

create table if not exists trials (
    id uuid primary key default uuid_generate_v4(),
    nct_id text unique,
    drug_id uuid references drugs (id) on delete set null,
    company_id uuid not null references companies (id) on delete cascade,
    phase text not null check (
        phase in ('Preclinical', 'Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', 'Phase III', 'Approved')
    ),
    indication_id uuid references indications (id) on delete set null,
    status text,
    sponsor text,
    is_single_arm boolean not null default false,
    -- Raw ClinicalTrials.gov API response (Phase 3 caching requirement).
    raw_ctgov_json jsonb,
    is_mock_data boolean not null default false,
    last_verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists trials_drug_id_idx on trials (drug_id);
create index if not exists trials_company_id_idx on trials (company_id);

create table if not exists trial_results (
    id uuid primary key default uuid_generate_v4(),
    trial_id uuid not null references trials (id) on delete cascade,
    -- Mirrors app/types/domain.ts TrialMetricKind.
    kind text not null check (kind in ('orr', 'hazard_ratio', 'pfs', 'os', 'generic')),
    label text not null,
    -- ORR: always required together (BUILD_BRIEF.txt §34) — a bare
    -- percentage is never derivable from this table without both.
    responders integer,
    evaluable integer,
    constraint trial_results_orr_pair check (
        (responders is null and evaluable is null) or (responders is not null and evaluable is not null)
    ),
    hazard_ratio numeric,
    value_text text,
    ci_low numeric,
    ci_high numeric,
    p_value numeric,
    endpoint_role text check (endpoint_role in ('primary', 'secondary', 'exploratory')),
    -- Required plain-language framing for HR results — see BUILD_BRIEF.txt §33.
    caption text,
    flag text,
    source_id uuid references sources (id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists trial_results_trial_id_idx on trial_results (trial_id);

-- ---------------------------------------------------------------------------
-- Feed / interpretation layer
-- ---------------------------------------------------------------------------

create table if not exists events (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references companies (id) on delete cascade,
    drug_id uuid references drugs (id) on delete set null,
    trial_id uuid references trials (id) on delete set null,
    event_type text not null,
    occurred_on date not null,
    title text not null,
    bottom_line text not null,
    -- Mirrors app/types/domain.ts EvidenceClassification.
    evidence_classification text not null check (
        evidence_classification in
        ('confirmatory_positive', 'encouraging_signal', 'inconclusive', 'negative_primary_endpoint')
    ),
    confidence text not null check (confidence in ('high', 'moderate', 'low')),
    is_mock_data boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists events_company_id_idx on events (company_id);
create index if not exists events_occurred_on_idx on events (occurred_on desc);

create table if not exists event_sources (
    event_id uuid not null references events (id) on delete cascade,
    source_id uuid not null references sources (id) on delete cascade,
    primary key (event_id, source_id)
);

-- Phase 7 interpretation layer: FACT / CALCULATED / INTERPRETATION /
-- SPECULATION are stored as separate labeled claims, never merged into one
-- blob of prose, so citation mapping (claim -> source_id) stays possible.
create table if not exists analyses (
    id uuid primary key default uuid_generate_v4(),
    event_id uuid references events (id) on delete cascade,
    company_id uuid references companies (id) on delete cascade,
    claim_type text not null check (claim_type in ('fact', 'calculated', 'interpretation', 'speculation')),
    content text not null,
    confidence text check (confidence in ('high', 'moderate', 'low')),
    source_id uuid references sources (id) on delete set null,
    -- Phase 10 (Ask BioLens) RAG scoping — populated once embeddings exist.
    embedding vector(1536),
    created_at timestamptz not null default now()
);
create index if not exists analyses_event_id_idx on analyses (event_id);
create index if not exists analyses_company_id_idx on analyses (company_id);

-- ---------------------------------------------------------------------------
-- User data (Phase 9)
-- ---------------------------------------------------------------------------

create table if not exists watchlists (
    id uuid primary key default uuid_generate_v4(),
    -- References Supabase Auth's users table.
    user_id uuid not null references auth.users (id) on delete cascade,
    entity_type text not null check (entity_type in ('company', 'drug', 'target')),
    entity_id uuid not null,
    created_at timestamptz not null default now(),
    unique (user_id, entity_type, entity_id)
);
create index if not exists watchlists_user_id_idx on watchlists (user_id);

-- Row-level security: users only ever see/modify their own watchlist rows.
alter table watchlists enable row level security;

create policy "watchlists_select_own" on watchlists
    for select using (auth.uid() = user_id);

create policy "watchlists_insert_own" on watchlists
    for insert with check (auth.uid() = user_id);

create policy "watchlists_delete_own" on watchlists
    for delete using (auth.uid() = user_id);
