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

notify pgrst, 'reload schema';
