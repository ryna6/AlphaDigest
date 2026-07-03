-- Make Barchart S&P 500 breadth its own canonical cache table.
-- The previous market_breadth_cache table only held the Barchart breadth row.
do $$
begin
  if to_regclass('public.barchart_market_breadth') is null and to_regclass('public.market_breadth_cache') is not null then
    alter table public.market_breadth_cache rename to barchart_market_breadth;
  end if;
end $$;

create table if not exists public.barchart_market_breadth (
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

alter table public.barchart_market_breadth
  add column if not exists above_50d_percent numeric,
  add column if not exists above_200d_percent numeric,
  add column if not exists highs_52w integer,
  add column if not exists lows_52w integer,
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barchart_market_breadth' and column_name = 'above_50d_ma') then
    execute 'update public.barchart_market_breadth set above_50d_percent = coalesce(above_50d_percent, above_50d_ma) where above_50d_percent is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barchart_market_breadth' and column_name = 'above_200d_ma') then
    execute 'update public.barchart_market_breadth set above_200d_percent = coalesce(above_200d_percent, above_200d_ma) where above_200d_percent is null';
  end if;
end $$;

alter table public.barchart_market_breadth
  alter column above_50d_percent set not null,
  alter column above_200d_percent set not null,
  alter column highs_52w set not null,
  alter column lows_52w set not null,
  alter column source_url set not null,
  alter column fetched_at set not null;

create index if not exists idx_barchart_market_breadth_fetched_at
on public.barchart_market_breadth (fetched_at desc);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barchart_market_breadth' and column_name = 'above_50d_ma') then
    alter table public.barchart_market_breadth drop column above_50d_ma;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barchart_market_breadth' and column_name = 'above_200d_ma') then
    alter table public.barchart_market_breadth drop column above_200d_ma;
  end if;
end $$;
