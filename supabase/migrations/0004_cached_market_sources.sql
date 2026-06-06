create table if not exists unusual_whales_news_feed (
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

create index if not exists idx_uw_news_feed_event_time
on unusual_whales_news_feed (event_time desc);

create table if not exists unusual_whales_featured_articles (
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
  country text,
  source_name text,
  source_url text,
  raw jsonb,
  content_hash text not null,
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
alter table unusual_whales_news_feed add column if not exists tickers text[] not null default '{}';
alter table unusual_whales_news_feed add column if not exists why_it_matters text;
alter table unusual_whales_news_feed add column if not exists source_name text;
alter table unusual_whales_news_feed add column if not exists source_url text;
alter table unusual_whales_news_feed add column if not exists publisher text;
alter table unusual_whales_news_feed add column if not exists sentiment text;
alter table unusual_whales_news_feed add column if not exists major boolean;
alter table unusual_whales_news_feed add column if not exists category text;
alter table unusual_whales_news_feed add column if not exists impact text;
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
alter table unusual_whales_featured_articles add column if not exists image_url text;
alter table unusual_whales_featured_articles add column if not exists excerpt text;
alter table unusual_whales_featured_articles add column if not exists content_text text;
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
alter table investing_economic_events add column if not exists country text;
alter table investing_economic_events add column if not exists source_name text;
alter table investing_economic_events add column if not exists source_url text;
alter table investing_economic_events add column if not exists raw jsonb;
alter table investing_economic_events add column if not exists content_hash text;
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
