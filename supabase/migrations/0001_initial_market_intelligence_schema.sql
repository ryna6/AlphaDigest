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
  data_source_id uuid references data_sources(id),
  status text not null check (status in ('fresh','delayed','stale','degraded','unavailable')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_count integer not null default 0,
  message text
);

create table if not exists raw_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid references data_sources(id),
  source_run_id uuid references source_runs(id),
  source_url text,
  payload jsonb not null,
  parse_version text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null,
  payload jsonb not null,
  freshness_status text not null check (freshness_status in ('fresh','delayed','stale','degraded','unavailable')),
  as_of timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  asset_type text not null,
  name text,
  sector text,
  exchange text,
  source_name text,
  source_url text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ticker, asset_type)
);

create table if not exists asset_prices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  ticker text,
  price numeric,
  change numeric,
  change_percent numeric,
  event_time timestamptz,
  fetched_at timestamptz not null default now(),
  raw_snapshot_id uuid references raw_source_snapshots(id),
  freshness_status text,
  created_at timestamptz not null default now()
);

create table if not exists ohlc_bars (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  ticker text,
  timeframe text not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  event_time timestamptz not null,
  source_name text,
  source_url text,
  raw_snapshot_id uuid references raw_source_snapshots(id),
  freshness_status text,
  created_at timestamptz not null default now()
);

create table if not exists news_items (id uuid primary key default gen_random_uuid(), external_id text, headline text not null, tickers text[], category text, impact text, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists economic_events (id uuid primary key default gen_random_uuid(), event_name text not null, event_time timestamptz, actual text, forecast text, previous text, importance text, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists earnings_events (id uuid primary key default gen_random_uuid(), ticker text, company text, event_time timestamptz, report_time text, expected_eps text, expected_revenue text, market_cap numeric, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists dark_pool_trades (id uuid primary key default gen_random_uuid(), ticker text, price numeric, size numeric, notional numeric, venue text, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists whale_trades (id uuid primary key default gen_random_uuid(), ticker text, trade_type text, premium numeric, bias text, expiry date, strike numeric, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists insider_trades (id uuid primary key default gen_random_uuid(), ticker text, insider text, role text, side text, value numeric, transaction_type text, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists congressional_trades (id uuid primary key default gen_random_uuid(), ticker text, issuer text, politician text, side text, amount_range text, traded_date date, published_date date, filed_after_days integer, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists institutional_holdings_13f (id uuid primary key default gen_random_uuid(), fund text, ticker text, shares numeric, market_value numeric, portfolio_weight numeric, qoq_change numeric, report_period text, filed_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists macro_observations (id uuid primary key default gen_random_uuid(), series_id text, label text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists put_call_observations (id uuid primary key default gen_random_uuid(), metric text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists aaii_sentiment_observations (id uuid primary key default gen_random_uuid(), bullish numeric, neutral numeric, bearish numeric, bull_bear_spread numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists market_breadth_observations (id uuid primary key default gen_random_uuid(), metric text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists sentiment_observations (id uuid primary key default gen_random_uuid(), metric text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
create table if not exists hormuz_updates (id uuid primary key default gen_random_uuid(), status text, risk_score numeric, summary text, as_of_date date, source_name text, source_url text, fetched_at timestamptz default now(), raw_snapshot_id uuid references raw_source_snapshots(id), freshness_status text, created_at timestamptz default now());
