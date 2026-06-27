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
create table if not exists hormuz_updates (id uuid primary key default gen_random_uuid(), external_id text, status text, risk_score numeric, summary text, as_of_date date, source_name text, source_url text, fetched_at timestamptz not null default now(), raw_snapshot_id uuid references raw_source_snapshots(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());create table if not exists data_sources (
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
create table if not exists unusual_whales_news_feed (
  id text primary key,
  headline text not null,
  event_time timestamptz not null,
  source_name text,
  source_url text,
  publisher text,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_uw_news_feed_event_time
on unusual_whales_news_feed (event_time desc);

create table if not exists unusual_whales_featured_articles (
  id text primary key,
  slug text not null unique,
  title text not null,
  published_at timestamptz,
  created_at_source timestamptz,
  tags text[] not null default '{}',
  excerpt text,
  content_html text,
  source_url text,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_uw_featured_articles_published_at
on unusual_whales_featured_articles (published_at desc nulls last);

create table if not exists investing_economic_events (
  id text primary key,
  event_id text,
  event_key text,
  event_name text not null,
  event_date date not null,
  time text,
  event_time timestamptz,
  importance text,
  stars integer,
  actual text,
  forecast text,
  previous text,
  is_highlighted boolean not null default false,
  highlight_reason text,
  source_url text,
  raw jsonb,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_investing_economic_events_event_date
on investing_economic_events (event_date, event_time);

create table if not exists market_quotes (
  id text primary key,
  source text not null,
  symbol text not null,
  display_symbol text not null,
  name text,
  price numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  market_time timestamptz,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_market_quotes_symbol_source
on market_quotes (source, symbol);

alter table unusual_whales_news_feed add column if not exists id text;
alter table unusual_whales_news_feed add column if not exists headline text;
alter table unusual_whales_news_feed add column if not exists event_time timestamptz;
alter table unusual_whales_news_feed add column if not exists source_name text;
alter table unusual_whales_news_feed add column if not exists source_url text;
alter table unusual_whales_news_feed add column if not exists publisher text;
alter table unusual_whales_news_feed add column if not exists raw jsonb;
alter table unusual_whales_news_feed add column if not exists content_hash text;
alter table unusual_whales_news_feed add column if not exists fetched_at timestamptz;
alter table unusual_whales_news_feed add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_uw_news_feed_id on unusual_whales_news_feed (id);

alter table unusual_whales_featured_articles add column if not exists id text;
alter table unusual_whales_featured_articles add column if not exists slug text;
alter table unusual_whales_featured_articles add column if not exists title text;
alter table unusual_whales_featured_articles add column if not exists published_at timestamptz;
alter table unusual_whales_featured_articles add column if not exists created_at_source timestamptz;
alter table unusual_whales_featured_articles add column if not exists tags text[] not null default '{}';
alter table unusual_whales_featured_articles add column if not exists excerpt text;
alter table unusual_whales_featured_articles add column if not exists content_html text;
alter table unusual_whales_featured_articles add column if not exists source_url text;
alter table unusual_whales_featured_articles add column if not exists raw jsonb;
alter table unusual_whales_featured_articles add column if not exists content_hash text;
alter table unusual_whales_featured_articles add column if not exists fetched_at timestamptz;
alter table unusual_whales_featured_articles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_uw_featured_articles_id on unusual_whales_featured_articles (id);
create unique index if not exists idx_uw_featured_articles_slug_unique on unusual_whales_featured_articles (slug);

alter table investing_economic_events add column if not exists id text;
alter table investing_economic_events add column if not exists event_id text;
alter table investing_economic_events add column if not exists event_key text;
alter table investing_economic_events add column if not exists event_name text;
alter table investing_economic_events add column if not exists event_date date;
alter table investing_economic_events add column if not exists time text;
alter table investing_economic_events add column if not exists event_time timestamptz;
alter table investing_economic_events add column if not exists importance text;
alter table investing_economic_events add column if not exists stars integer;
alter table investing_economic_events add column if not exists actual text;
alter table investing_economic_events add column if not exists forecast text;
alter table investing_economic_events add column if not exists previous text;
alter table investing_economic_events add column if not exists is_highlighted boolean not null default false;
alter table investing_economic_events add column if not exists highlight_reason text;
alter table investing_economic_events add column if not exists source_url text;
alter table investing_economic_events add column if not exists raw jsonb;
alter table investing_economic_events add column if not exists fetched_at timestamptz;
alter table investing_economic_events add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_investing_economic_events_id on investing_economic_events (id);

alter table market_quotes add column if not exists id text;
alter table market_quotes add column if not exists source text;
alter table market_quotes add column if not exists symbol text;
alter table market_quotes add column if not exists display_symbol text;
alter table market_quotes add column if not exists name text;
alter table market_quotes add column if not exists price numeric;
alter table market_quotes add column if not exists previous_close numeric;
alter table market_quotes add column if not exists change numeric;
alter table market_quotes add column if not exists change_percent numeric;
alter table market_quotes add column if not exists market_time timestamptz;
alter table market_quotes add column if not exists raw jsonb;
alter table market_quotes add column if not exists content_hash text;
alter table market_quotes add column if not exists fetched_at timestamptz;
alter table market_quotes add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_market_quotes_id on market_quotes (id);

-- Frontend-ready Supabase-first dashboard cache. Additive migrations normalize older snapshot_key/as_of drafts.
create table if not exists public.dashboard_snapshots (
  key text primary key,
  payload jsonb not null,
  mode text,
  notices jsonb default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  source_hash text,
  metadata jsonb default '{}'::jsonb
);
create unique index if not exists dashboard_snapshots_key_uidx on public.dashboard_snapshots (key);
create index if not exists dashboard_snapshots_expires_at_idx on public.dashboard_snapshots (expires_at);
create index if not exists dashboard_snapshots_generated_at_idx on public.dashboard_snapshots (generated_at desc);
-- Adds live Whale Feed storage and Dark Pool trade-size/NBBO fields for Flow refresh functions.
create table if not exists public.unusual_whales_whale_feed (
  external_id text primary key,
  executed_at timestamptz not null,
  ticker text not null,
  sector text,
  price numeric,
  nbbo_ask numeric,
  nbbo_bid numeric,
  side text,
  sentiment text,
  premium numeric,
  size numeric,
  volume numeric,
  avg30_volume numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uw_whale_feed_executed_at_idx on public.unusual_whales_whale_feed (executed_at desc);
create index if not exists uw_whale_feed_ticker_executed_at_idx on public.unusual_whales_whale_feed (ticker, executed_at desc);
create index if not exists uw_whale_feed_premium_idx on public.unusual_whales_whale_feed (premium desc);

-- Supports refresh-dark-pool storing individual print size and NBBO side inference.
alter table public.unusual_whales_dark_pool_flows add column if not exists size numeric;
alter table public.unusual_whales_dark_pool_flows add column if not exists avg30_volume numeric;
alter table public.unusual_whales_dark_pool_flows add column if not exists nbbo_bid numeric;
alter table public.unusual_whales_dark_pool_flows add column if not exists nbbo_ask numeric;
alter table public.unusual_whales_dark_pool_flows add column if not exists side text;
alter table public.unusual_whales_dark_pool_flows add column if not exists sentiment text;

alter table unusual_whales_featured_articles drop column if exists image_url;

notify pgrst, 'reload schema';
