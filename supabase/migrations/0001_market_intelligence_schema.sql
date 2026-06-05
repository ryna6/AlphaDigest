-- Market Intelligence Dashboard Supabase schema proposal.
create extension if not exists pgcrypto;

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  source_url text,
  enabled boolean not null default true,
  refresh_frequency_minutes integer,
  freshness_threshold_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('fresh','delayed','stale','degraded','unavailable')),
  failure_count integer not null default 0,
  message text
);

create table if not exists raw_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  fetched_at timestamptz not null default now(),
  parse_version text,
  content_type text,
  raw_payload jsonb
);

create table if not exists dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null,
  as_of timestamptz not null,
  freshness_status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  ticker text unique,
  name text,
  asset_type text,
  sector text,
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_prices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  ticker text,
  price numeric,
  absolute_change numeric,
  percent_change numeric,
  event_time timestamptz,
  fetched_at timestamptz not null default now(),
  source_name text,
  source_url text,
  raw_snapshot_id uuid references raw_source_snapshots(id),
  freshness_status text
);

create table if not exists ohlc_bars (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  ticker text,
  interval text,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  event_time timestamptz not null,
  fetched_at timestamptz not null default now(),
  source_name text,
  raw_snapshot_id uuid references raw_source_snapshots(id),
  unique(ticker, interval, event_time, source_name)
);

create table if not exists news_items (id uuid primary key default gen_random_uuid(), external_id text, headline text not null, ticker text[], category text, impact text, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists economic_events (id uuid primary key default gen_random_uuid(), external_id text, event_name text not null, actual text, forecast text, previous text, importance text, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists earnings_events (id uuid primary key default gen_random_uuid(), external_id text, ticker text, company text, report_time text, expected_eps text, expected_revenue text, market_cap numeric, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists dark_pool_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, price numeric, size numeric, premium numeric, venue text, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists whale_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, trade_type text, premium numeric, sentiment text, expiry date, strike numeric, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists insider_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, insider text, role text, side text, value numeric, transaction_type text, event_time timestamptz, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists congressional_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, issuer text, politician text, side text, amount_range text, traded_at date, published_at date, filed_after_days integer, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists institutional_holdings_13f (id uuid primary key default gen_random_uuid(), external_id text, fund text, ticker text, shares numeric, market_value numeric, portfolio_weight numeric, qoq_change numeric, report_period text, filed_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists macro_observations (id uuid primary key default gen_random_uuid(), series_id text, label text, value numeric, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists put_call_observations (id uuid primary key default gen_random_uuid(), ratio_type text, value numeric, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists aaii_sentiment_observations (id uuid primary key default gen_random_uuid(), bullish numeric, neutral numeric, bearish numeric, bull_bear_spread numeric, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists market_breadth_observations (id uuid primary key default gen_random_uuid(), universe text, advancers integer, decliners integer, pct_above_20d numeric, pct_above_50d numeric, pct_above_200d numeric, new_highs integer, new_lows integer, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists sentiment_observations (id uuid primary key default gen_random_uuid(), label text, value numeric, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists hormuz_updates (id uuid primary key default gen_random_uuid(), status text, risk_score numeric, methodology_url text, attribution text, as_of_date date, fetched_at timestamptz default now(), source_name text, source_url text, raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
