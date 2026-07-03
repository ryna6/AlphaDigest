create table if not exists unusual_whales_sp500_heatmap (
  id text primary key,
  ticker text not null,
  sector text,
  normalized_sector text,
  marketcap numeric not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  prev_close numeric not null,
  tape_time timestamptz not null,
  as_of_date date not null,
  fetched_at timestamptz not null default now(),
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unusual_whales_sp500_heatmap_ticker_date
on unusual_whales_sp500_heatmap (as_of_date, ticker);

create index if not exists idx_unusual_whales_sp500_heatmap_date_marketcap
on unusual_whales_sp500_heatmap (as_of_date desc, marketcap desc);
