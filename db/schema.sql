-- asof — the facts store.
--
-- Append-only. Nothing is ever updated and nothing is ever deleted.
--
-- Supersession is only knowable in hindsight: when Exa records "$1.89/hr on
-- provider X" it cannot know that number is void in four hours. A store that
-- resolves conflicts at WRITE time has to guess. This one resolves them at
-- READ time, so a superseded price stays retrievable — it just loses.

create extension if not exists vector;

-- Half-lives live here as data, not in application code, so the decayed read
-- can happen entirely in SQL. Mirrors src/memory/halflife.ts; that file is the
-- source of truth and seeds this table.
create table if not exists kind (
  kind            text primary key,
  half_life_days  double precision,            -- null = pinned
  scope           text not null default 'time' -- 'time' | 'commit'
                  check (scope in ('time', 'commit')),
  why             text not null
);

create table if not exists fact (
  id              bigserial primary key,
  kind            text not null references kind(kind),

  -- what the fact is about. provider is null for owner-scoped facts (policy).
  provider        text,
  sku             text,                        -- 'a100-80gb-sxm', 'h100-pcie'
  workload        text,                        -- null for market facts

  -- the claim
  value           jsonb not null,
  unit            text,

  -- when it was true. observed_at is the clock the decay reads from; we never
  -- trust now() at write time for backfilled or replayed facts.
  observed_at     timestamptz not null,
  recorded_at     timestamptz not null default now(),

  -- provenance. 'exa' | 'kernel' | 'probe' | 'owner' | 'run'
  source          text not null,
  source_detail   text,

  -- commit-scoped facts hang from this. null for time-scoped facts.
  code_fingerprint text,

  embedding       vector(1536)
);

create index if not exists fact_kind_observed_idx
  on fact (kind, observed_at desc);
create index if not exists fact_provider_sku_idx
  on fact (provider, sku, observed_at desc);
create index if not exists fact_workload_idx
  on fact (workload, kind, observed_at desc)
  where workload is not null;
create index if not exists fact_fingerprint_idx
  on fact (code_fingerprint)
  where code_fingerprint is not null;

-- Every decision the broker makes is recorded with the fact ids it stood on and
-- the ones it withheld. This is the audit surface: "why did you spend $34" is
-- answerable months later, against facts that have since decayed away.
create table if not exists decision (
  id              bigserial primary key,
  workload        text not null,
  decided_at      timestamptz not null default now(),
  chose_provider  text not null,
  chose_sku       text not null,
  est_cost_usd    numeric(12,4),
  est_hours       double precision,
  stood_on        bigint[] not null,           -- fact ids that survived
  withheld        jsonb not null default '[]', -- [{kind, fact_id, suppressed_by}]
  rationale       text
);
