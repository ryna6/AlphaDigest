-- Rename the canonical S&P 500 Market Breadth cache away from the retired Barchart-specific name.
do $$
begin
  if to_regclass('public.market_breadth') is null and to_regclass('public.barchart_market_breadth') is not null then
    alter table public.barchart_market_breadth rename to market_breadth;
  elsif to_regclass('public.market_breadth') is null then
    create table public.market_breadth (
      id text primary key,
      above_50d_percent numeric not null,
      above_200d_percent numeric not null,
      highs_52w integer not null,
      lows_52w integer not null,
      source_url text not null,
      source_updated_at timestamptz,
      fetched_at timestamptz not null,
      content_hash text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

alter table public.market_breadth
  add column if not exists above_50d_percent numeric,
  add column if not exists above_200d_percent numeric,
  add column if not exists highs_52w integer,
  add column if not exists lows_52w integer,
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists moving_average_source text not null default 'Investing.com',
  add column if not exists high_low_source text not null default 'Yahoo Finance filtered to cached S&P 500 constituents',
  add column if not exists fetched_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.market_breadth
set
  moving_average_source = coalesce(nullif(moving_average_source, ''), 'Investing.com'),
  high_low_source = coalesce(nullif(high_low_source, ''), 'Yahoo Finance filtered to cached S&P 500 constituents'),
  source_url = coalesce(nullif(source_url, ''), 'https://ca.investing.com/indices/s-p-500-stocks-above-50-day-average,https://ca.investing.com/indices/sp-500-stocks-above-200-day-average-chart,https://ca.finance.yahoo.com/research-hub/screener/recent_52_week_highs/,https://ca.finance.yahoo.com/research-hub/screener/recent_52_week_lows/'),
  fetched_at = coalesce(fetched_at, now())
where id = 'sp500';

alter table public.market_breadth
  alter column above_50d_percent set not null,
  alter column above_200d_percent set not null,
  alter column highs_52w set not null,
  alter column lows_52w set not null,
  alter column source_url set not null,
  alter column fetched_at set not null;

drop index if exists public.idx_barchart_market_breadth_fetched_at;
create index if not exists idx_market_breadth_fetched_at on public.market_breadth (fetched_at desc);
