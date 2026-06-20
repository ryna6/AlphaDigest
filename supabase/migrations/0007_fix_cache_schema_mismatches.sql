-- Idempotent cache schema repair for Netlify/Supabase refresh functions.
-- Safe to re-run: uses create table/index if not exists and add column if not exists.
-- Important: add/repair columns before creating indexes so partially-created
-- production tables do not fail with "column does not exist".

-- Ensure source cache tables exist, then normalize partially-created production tables.
create table if not exists public.unusual_whales_news_feed (
  id text primary key,
  headline text not null,
  event_time timestamptz not null,
  tickers text[] not null default '{}',
  why_it_matters text,
  source_name text,
  source_url text,
  publisher text,
  sentiment text,
  major boolean,
  category text,
  impact text,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.unusual_whales_news_feed add column if not exists id text;
alter table public.unusual_whales_news_feed add column if not exists headline text;
alter table public.unusual_whales_news_feed add column if not exists event_time timestamptz;
alter table public.unusual_whales_news_feed add column if not exists tickers text[] default '{}';
alter table public.unusual_whales_news_feed add column if not exists why_it_matters text;
alter table public.unusual_whales_news_feed add column if not exists source_name text;
alter table public.unusual_whales_news_feed add column if not exists source_url text;
alter table public.unusual_whales_news_feed add column if not exists publisher text;
alter table public.unusual_whales_news_feed add column if not exists sentiment text;
alter table public.unusual_whales_news_feed add column if not exists major boolean;
alter table public.unusual_whales_news_feed add column if not exists category text;
alter table public.unusual_whales_news_feed add column if not exists impact text;
alter table public.unusual_whales_news_feed add column if not exists raw jsonb;
alter table public.unusual_whales_news_feed add column if not exists content_hash text;
alter table public.unusual_whales_news_feed add column if not exists fetched_at timestamptz;
alter table public.unusual_whales_news_feed add column if not exists updated_at timestamptz default now();
create unique index if not exists idx_uw_news_feed_id on public.unusual_whales_news_feed (id);
create index if not exists idx_uw_news_feed_event_time on public.unusual_whales_news_feed (event_time desc);

create table if not exists public.unusual_whales_featured_articles (
  id text primary key,
  slug text not null unique,
  title text not null,
  published_at timestamptz,
  created_at_source timestamptz,
  tags text[] not null default '{}',
  image_url text,
  excerpt text,
  content_text text,
  content_html text,
  source_url text,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.unusual_whales_featured_articles add column if not exists id text;
alter table public.unusual_whales_featured_articles add column if not exists slug text;
alter table public.unusual_whales_featured_articles add column if not exists title text;
alter table public.unusual_whales_featured_articles add column if not exists published_at timestamptz;
alter table public.unusual_whales_featured_articles add column if not exists created_at_source timestamptz;
alter table public.unusual_whales_featured_articles add column if not exists tags text[] default '{}';
alter table public.unusual_whales_featured_articles add column if not exists image_url text;
alter table public.unusual_whales_featured_articles add column if not exists excerpt text;
alter table public.unusual_whales_featured_articles add column if not exists content_text text;
alter table public.unusual_whales_featured_articles add column if not exists content_html text;
alter table public.unusual_whales_featured_articles add column if not exists source_url text;
alter table public.unusual_whales_featured_articles add column if not exists raw jsonb;
alter table public.unusual_whales_featured_articles add column if not exists content_hash text;
alter table public.unusual_whales_featured_articles add column if not exists fetched_at timestamptz;
alter table public.unusual_whales_featured_articles add column if not exists updated_at timestamptz default now();
create unique index if not exists idx_uw_featured_articles_id on public.unusual_whales_featured_articles (id);
create unique index if not exists idx_uw_featured_articles_slug_unique on public.unusual_whales_featured_articles (slug);
create index if not exists idx_uw_featured_articles_published_at on public.unusual_whales_featured_articles (published_at desc nulls last);

create table if not exists public.investing_economic_events (
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
  country text,
  source_name text,
  source_url text,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.investing_economic_events add column if not exists id text;
alter table public.investing_economic_events add column if not exists event_id text;
alter table public.investing_economic_events add column if not exists event_key text;
alter table public.investing_economic_events add column if not exists event_name text;
alter table public.investing_economic_events add column if not exists event_date date;
alter table public.investing_economic_events add column if not exists time text;
alter table public.investing_economic_events add column if not exists event_time timestamptz;
alter table public.investing_economic_events add column if not exists importance text;
alter table public.investing_economic_events add column if not exists stars integer;
alter table public.investing_economic_events add column if not exists actual text;
alter table public.investing_economic_events add column if not exists forecast text;
alter table public.investing_economic_events add column if not exists previous text;
alter table public.investing_economic_events add column if not exists is_highlighted boolean default false;
alter table public.investing_economic_events add column if not exists highlight_reason text;
alter table public.investing_economic_events add column if not exists country text;
alter table public.investing_economic_events add column if not exists source_name text;
alter table public.investing_economic_events add column if not exists source_url text;
alter table public.investing_economic_events add column if not exists raw jsonb;
alter table public.investing_economic_events add column if not exists content_hash text;
alter table public.investing_economic_events add column if not exists fetched_at timestamptz;
alter table public.investing_economic_events add column if not exists updated_at timestamptz default now();
create unique index if not exists idx_investing_economic_events_id on public.investing_economic_events (id);
create index if not exists idx_investing_economic_events_event_date on public.investing_economic_events (event_date, event_time);

create table if not exists public.market_quotes (
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
alter table public.market_quotes add column if not exists id text;
alter table public.market_quotes add column if not exists source text;
alter table public.market_quotes add column if not exists symbol text;
alter table public.market_quotes add column if not exists display_symbol text;
alter table public.market_quotes add column if not exists name text;
alter table public.market_quotes add column if not exists price numeric;
alter table public.market_quotes add column if not exists previous_close numeric;
alter table public.market_quotes add column if not exists change numeric;
alter table public.market_quotes add column if not exists change_percent numeric;
alter table public.market_quotes add column if not exists market_time timestamptz;
alter table public.market_quotes add column if not exists raw jsonb;
alter table public.market_quotes add column if not exists content_hash text;
alter table public.market_quotes add column if not exists fetched_at timestamptz;
alter table public.market_quotes add column if not exists updated_at timestamptz default now();
create unique index if not exists idx_market_quotes_id on public.market_quotes (id);
create unique index if not exists idx_market_quotes_symbol_source on public.market_quotes (source, symbol);

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

alter table public.dashboard_snapshots add column if not exists key text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dashboard_snapshots'
      and column_name = 'snapshot_key'
  ) then
    update public.dashboard_snapshots set key = snapshot_key where key is null and snapshot_key is not null;
  end if;
end $$;
alter table public.dashboard_snapshots add column if not exists payload jsonb;
alter table public.dashboard_snapshots add column if not exists mode text;
alter table public.dashboard_snapshots add column if not exists notices jsonb default '[]'::jsonb;
alter table public.dashboard_snapshots add column if not exists generated_at timestamptz not null default now();
alter table public.dashboard_snapshots add column if not exists expires_at timestamptz;
alter table public.dashboard_snapshots add column if not exists source_hash text;
alter table public.dashboard_snapshots add column if not exists metadata jsonb default '{}'::jsonb;
create unique index if not exists dashboard_snapshots_key_uidx on public.dashboard_snapshots (key);
create index if not exists dashboard_snapshots_expires_at_idx on public.dashboard_snapshots (expires_at);
create index if not exists dashboard_snapshots_generated_at_idx on public.dashboard_snapshots (generated_at desc);

create table if not exists public.put_call_observations (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  ratio_type text,
  value numeric,
  equity_ratio numeric,
  index_ratio numeric,
  total_ratio numeric,
  market_date date,
  as_of_date date,
  source_timezone text,
  display_timezone text,
  source_as_of_central text,
  as_of_eastern timestamptz,
  scraped_at timestamptz,
  freshness text,
  source_name text,
  source_url text,
  fetched_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.put_call_observations add column if not exists external_id text;
alter table public.put_call_observations add column if not exists ratio_type text;
alter table public.put_call_observations add column if not exists value numeric;
alter table public.put_call_observations add column if not exists equity_ratio numeric;
alter table public.put_call_observations add column if not exists index_ratio numeric;
alter table public.put_call_observations add column if not exists total_ratio numeric;
alter table public.put_call_observations add column if not exists market_date date;
alter table public.put_call_observations add column if not exists as_of_date date;
alter table public.put_call_observations add column if not exists source_timezone text;
alter table public.put_call_observations add column if not exists display_timezone text;
alter table public.put_call_observations add column if not exists source_as_of_central text;
alter table public.put_call_observations add column if not exists as_of_eastern timestamptz;
alter table public.put_call_observations add column if not exists scraped_at timestamptz;
alter table public.put_call_observations add column if not exists freshness text;
alter table public.put_call_observations add column if not exists source_name text;
alter table public.put_call_observations add column if not exists source_url text;
alter table public.put_call_observations add column if not exists fetched_at timestamptz not null default now();
alter table public.put_call_observations add column if not exists raw jsonb;
alter table public.put_call_observations add column if not exists created_at timestamptz not null default now();
alter table public.put_call_observations add column if not exists updated_at timestamptz not null default now();
create unique index if not exists put_call_observations_external_id_key on public.put_call_observations(external_id);
create index if not exists put_call_observations_ratio_as_of_eastern_idx on public.put_call_observations(ratio_type, as_of_eastern desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

notify pgrst, 'reload schema';
