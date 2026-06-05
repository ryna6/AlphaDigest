create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  source_url text,
  source_type text not null,
  enabled boolean not null default true,
  refresh_frequency text,
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references data_sources(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_count integer not null default 0,
  message text,
  parse_version text
);

create table if not exists raw_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references data_sources(id),
  source_run_id uuid references source_runs(id),
  source_url text,
  content_type text,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null,
  payload jsonb not null,
  as_of timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  ticker text unique,
  name text,
  asset_type text not null,
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
  raw_snapshot_id uuid references raw_source_snapshots(id),
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  fetched_at timestamptz not null default now(),
  raw_snapshot_id uuid references raw_source_snapshots(id),
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists news_items (id uuid primary key default gen_random_uuid(), external_id text, headline text not null, tickers text[], event_time timestamptz, why_it_matters text, category text, impact text, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists economic_events (id uuid primary key default gen_random_uuid(), external_id text, event_name text not null, event_time timestamptz, actual text, forecast text, previous text, importance text, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists earnings_events (id uuid primary key default gen_random_uuid(), external_id text, ticker text, company text, event_time timestamptz, report_timing text, expected_eps text, expected_revenue text, market_cap text, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists dark_pool_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, price numeric, size numeric, notional numeric, venue text, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists whale_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, trade_type text, premium numeric, bias text, expiry date, strike numeric, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists insider_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, insider text, role text, side text, value numeric, transaction_type text, event_time timestamptz, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists congressional_trades (id uuid primary key default gen_random_uuid(), external_id text, ticker text, issuer text, politician text, side text, amount_range text, published_date date, traded_date date, filed_after text, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists institutional_holdings_13f (id uuid primary key default gen_random_uuid(), external_id text, fund text, ticker text, shares numeric, market_value numeric, portfolio_weight numeric, qoq_change numeric, report_period text, filed_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists macro_observations (id uuid primary key default gen_random_uuid(), external_id text, series_name text, series_id text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists put_call_observations (id uuid primary key default gen_random_uuid(), external_id text, ratio_type text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists aaii_sentiment_observations (id uuid primary key default gen_random_uuid(), bullish numeric, neutral numeric, bearish numeric, bull_bear_spread numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists market_breadth_observations (id uuid primary key default gen_random_uuid(), universe text, advancers integer, decliners integer, above_20d_ma numeric, above_50d_ma numeric, above_200d_ma numeric, new_highs integer, new_lows integer, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists sentiment_observations (id uuid primary key default gen_random_uuid(), metric_name text, value numeric, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists hormuz_updates (id uuid primary key default gen_random_uuid(), external_id text, status text, risk_score numeric, summary text, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
