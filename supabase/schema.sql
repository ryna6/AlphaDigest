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


create table if not exists unusual_whales_sp500_heatmap (id text primary key, ticker text not null, sector text, normalized_sector text, marketcap numeric not null, open numeric, high numeric, low numeric, close numeric not null, prev_close numeric not null, tape_time timestamptz not null, as_of_date date not null, fetched_at timestamptz not null default now(), content_hash text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists idx_unusual_whales_sp500_heatmap_ticker_date on unusual_whales_sp500_heatmap (as_of_date, ticker);
create index if not exists idx_unusual_whales_sp500_heatmap_date_marketcap on unusual_whales_sp500_heatmap (as_of_date desc, marketcap desc);



-- Daily candle cache final schema (additive migration 0036; legacy breadth provider tables dropped by 0037).
create table if not exists public.sp500_daily_candles (symbol text not null, provider_symbol text not null, trading_date date not null, open numeric not null, high numeric not null, low numeric not null, close numeric not null, volume numeric, previous_close numeric, source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (symbol, trading_date), constraint sp500_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0), constraint sp500_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low));
create index if not exists idx_sp500_daily_candles_symbol_date_desc on public.sp500_daily_candles (symbol, trading_date desc);
create index if not exists idx_sp500_daily_candles_date_symbol on public.sp500_daily_candles (trading_date desc, symbol);
create table if not exists public.market_daily_candles (symbol text not null, provider_symbol text not null, asset_group text, trading_date date not null, open numeric not null, high numeric not null, low numeric not null, close numeric not null, volume numeric, previous_close numeric, source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (symbol, trading_date), constraint market_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0), constraint market_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low));
create index if not exists idx_market_daily_candles_symbol_date_desc on public.market_daily_candles (symbol, trading_date desc);
create index if not exists idx_market_daily_candles_date_symbol on public.market_daily_candles (trading_date desc, symbol);
create table if not exists public.crypto_daily_candles (symbol text not null, provider_symbol text not null, trading_date date not null, open numeric not null, high numeric not null, low numeric not null, close numeric not null, volume numeric, previous_close numeric, source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (symbol, trading_date), constraint crypto_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0), constraint crypto_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low));
create index if not exists idx_crypto_daily_candles_symbol_date_desc on public.crypto_daily_candles (symbol, trading_date desc);
create index if not exists idx_crypto_daily_candles_date_symbol on public.crypto_daily_candles (trading_date desc, symbol);
create table if not exists public.equity_candle_backfill_state (job_key text not null, symbol text not null, table_name text not null check (table_name in ('sp500_daily_candles','market_daily_candles')), requested_from date not null, requested_to date not null, latest_completed_date date, status text not null default 'pending' check (status in ('pending','running','completed','failed')), attempt_count integer not null default 0, last_error text, lock_token uuid, locked_at timestamptz, started_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(), primary key (job_key, symbol, table_name));
create index if not exists idx_equity_candle_backfill_state_status on public.equity_candle_backfill_state (job_key, status, updated_at);

-- Atomic state claim used by the Netlify equity historical backfill worker.
create or replace function public.claim_equity_candle_backfill_batch(p_job_key text, p_limit integer, p_lock_token uuid, p_lock_timeout_minutes integer default 30) returns setof public.equity_candle_backfill_state language plpgsql security definer set search_path = public as $$
begin
  update public.equity_candle_backfill_state set status='pending', lock_token=null, locked_at=null, updated_at=now(), last_error=coalesce(last_error,'stale lock released') where job_key=p_job_key and status='running' and locked_at < now()-make_interval(mins=>p_lock_timeout_minutes);
  return query with candidates as (select job_key,symbol,table_name from public.equity_candle_backfill_state where job_key=p_job_key and status in ('pending','failed') order by requested_to,updated_at,symbol for update skip locked limit greatest(1,least(p_limit,5))) update public.equity_candle_backfill_state s set status='running',lock_token=p_lock_token,locked_at=now(),started_at=coalesce(s.started_at,now()),attempt_count=s.attempt_count+1,updated_at=now() from candidates c where (s.job_key,s.symbol,s.table_name)=(c.job_key,c.symbol,c.table_name) returning s.*;
end $$;
grant execute on function public.claim_equity_candle_backfill_batch(text,integer,uuid,integer) to service_role;

-- Canonical cleanup (0041): retired Economy/FRED and redundant cache columns.
delete from public.dashboard_snapshots where key = 'economy:latest';
delete from public.data_refresh_metadata where source in ('fred_economy', 'economy', 'dashboard_snapshot:economy:latest', 'economy:latest');
delete from public.job_runs where function_name = 'refresh-economy' or source = 'FRED';
drop table if exists public.fred_economy;
alter table public.dashboard_snapshots drop column if exists source_hash;
alter table public.crypto_daily_candles drop column if exists previous_close, drop column if exists source, drop column if exists source_timestamp, drop column if exists created_at, drop column if exists updated_at;
alter table public.market_daily_candles drop column if exists source_timestamp, drop column if exists created_at, drop column if exists updated_at;
alter table public.investing_economic_events drop column if exists time, drop column if exists raw, drop column if exists source_url, drop column if exists updated_at;
delete from public.market_quotes a using public.market_quotes b where a.symbol = b.symbol and (a.fetched_at, a.ctid) < (b.fetched_at, b.ctid);
drop index if exists public.idx_market_quotes_symbol_source;
alter table public.market_quotes drop constraint if exists market_quotes_pkey;
drop index if exists public.idx_market_quotes_id;
alter table public.market_quotes drop column if exists id, drop column if exists source, drop column if exists raw, drop column if exists content_hash, drop column if exists updated_at;
alter table public.market_quotes alter column symbol set not null;
alter table public.market_quotes add constraint market_quotes_pkey primary key (symbol);
alter table public.job_runs drop column if exists created_at;
alter table public.market_summary_history drop column if exists created_at;

-- Second source-cache cleanup. Business timestamps remain intact; fetched_at is
-- the single provider-ingestion timestamp for the affected source tables.

-- Congressional ownership has been retired end-to-end.
delete from public.dashboard_snapshots
where key ilike '%congress%'
   or payload::text ilike '%congress%';
delete from public.data_refresh_metadata where source ilike '%congress%';
delete from public.job_runs
where function_name ilike '%congress%' or job_name ilike '%congress%';
drop table if exists public.unusual_whales_congressional_trades cascade;
drop table if exists public.unusual_whales_congressional_portfolios cascade;
drop table if exists public.congressional_trades cascade;

-- Provider candle symbols are identical to the canonical application ticker.
alter table public.crypto_daily_candles drop column if exists provider_symbol;
alter table public.sp500_daily_candles
  drop column if exists provider_symbol,
  drop column if exists source,
  drop column if exists created_at,
  drop column if exists updated_at;

-- Stable provider IDs remain the natural keys for flow rows.
delete from public.unusual_whales_dark_pool_flows where executed_at < now() - interval '14 days';
drop trigger if exists set_updated_at_unusual_whales_dark_pool_flows on public.unusual_whales_dark_pool_flows;
alter table public.unusual_whales_dark_pool_flows
  drop column if exists sentiment,
  drop column if exists nbbo_bid,
  drop column if exists nbbo_ask,
  drop column if exists side,
  drop column if exists created_at,
  drop column if exists updated_at;

drop trigger if exists set_updated_at_unusual_whales_insider_trades on public.unusual_whales_insider_trades;
alter table public.unusual_whales_insider_trades
  drop column if exists created_at,
  drop column if exists updated_at;

drop trigger if exists set_updated_at_unusual_whales_whale_feed on public.unusual_whales_whale_feed;
alter table public.unusual_whales_whale_feed
  drop column if exists created_at,
  drop column if exists updated_at;

-- Earnings retains its deterministic event ID and per-row content hash for
-- overlap-safe upserts/change detection, but not unused provider payload fields.
alter table public.unusual_whales_earnings_events
  drop column if exists market_time,
  drop column if exists sector,
  drop column if exists raw,
  drop column if exists expected_move,
  drop column if exists implied_move,
  drop column if exists updated_at;

alter table public.unusual_whales_featured_articles
  drop column if exists raw,
  drop column if exists content_hash,
  drop column if exists updated_at;
alter table public.unusual_whales_news_feed
  drop column if exists raw,
  drop column if exists content_hash,
  drop column if exists source_name,
  drop column if exists updated_at;

-- Only the latest heatmap observation is retained, so ticker is the natural key.
delete from public.unusual_whales_sp500_heatmap older
using public.unusual_whales_sp500_heatmap newer
where older.ticker = newer.ticker
  and (older.as_of_date, older.fetched_at, older.ctid)
      < (newer.as_of_date, newer.fetched_at, newer.ctid);
alter table public.unusual_whales_sp500_heatmap drop constraint if exists unusual_whales_sp500_heatmap_pkey;
drop index if exists public.idx_unusual_whales_sp500_heatmap_ticker_date;
alter table public.unusual_whales_sp500_heatmap
  drop column if exists id,
  drop column if exists content_hash,
  drop column if exists created_at,
  drop column if exists updated_at;
alter table public.unusual_whales_sp500_heatmap add constraint unusual_whales_sp500_heatmap_pkey primary key (ticker);

-- Sentinel 1970 rows were introduced for legacy rows with no provider report
-- period and are not legitimate 13F quarters. Keep the five most recent provider
-- quarter-ends per investor type to tolerate an incomplete new quarter.
delete from public.unusual_whales_institutional_ticker_flow where report_date < date '1971-01-01';
with retained as (
  select investor_type, report_date,
         dense_rank() over (partition by investor_type order by report_date desc) as quarter_rank
  from public.unusual_whales_institutional_ticker_flow
  group by investor_type, report_date
)
delete from public.unusual_whales_institutional_ticker_flow flow
using retained
where flow.investor_type = retained.investor_type
  and flow.report_date = retained.report_date
  and retained.quarter_rank > 5;

-- Remove lifecycle timestamps and their trigger maintenance; report/activity
-- dates remain the business keys and fetched_at remains freshness metadata.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'unusual_whales_institutional_ticker_flow',
    'unusual_whales_institutional_sector_exposure',
    'unusual_whales_tracked_institutions',
    'unusual_whales_tracked_institution_history',
    'unusual_whales_tracked_institution_holdings',
    'unusual_whales_tracked_institution_options',
    'unusual_whales_tracked_institution_activity'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || table_name, table_name);
    execute format('alter table public.%I drop column if exists created_at, drop column if exists updated_at', table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
