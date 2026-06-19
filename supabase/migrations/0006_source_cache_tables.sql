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
create unique index if not exists idx_market_quotes_symbol_source on public.market_quotes (source, symbol);

alter table public.unusual_whales_featured_articles add column if not exists created_at_source timestamptz;

-- Normalize partially-created production tables without dropping data.
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

alter table public.unusual_whales_featured_articles add column if not exists id text;
alter table public.unusual_whales_featured_articles add column if not exists slug text;
alter table public.unusual_whales_featured_articles add column if not exists title text;
alter table public.unusual_whales_featured_articles add column if not exists published_at timestamptz;
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
