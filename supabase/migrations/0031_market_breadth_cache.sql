create table if not exists public.market_breadth_cache (
  id text primary key,
  above_50d_ma numeric not null,
  above_200d_ma numeric not null,
  highs_52w integer not null,
  lows_52w integer not null,
  source_url text not null,
  fetched_at timestamptz not null,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_breadth_cache_fetched_at
on public.market_breadth_cache (fetched_at desc);
