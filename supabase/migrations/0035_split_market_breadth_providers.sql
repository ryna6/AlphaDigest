-- Split Market Breadth provider caches into provider-owned tables while preserving market_breadth.

create table if not exists public."%_above_ma" (
  id text primary key default 'sp500',
  above_50d_timestamp bigint not null,
  above_50d_open numeric not null,
  above_50d_high numeric not null,
  above_50d_low numeric not null,
  above_50d_close numeric not null,
  above_200d_timestamp bigint not null,
  above_200d_open numeric not null,
  above_200d_high numeric not null,
  above_200d_low numeric not null,
  above_200d_close numeric not null,
  source_url text,
  content_hash text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public."52w_high_low" (
  id text primary key default 'sp500',
  highs_52w integer not null check (highs_52w >= 0),
  lows_52w integer not null check (lows_52w >= 0),
  source_url text,
  content_hash text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_percent_above_ma_fetched_at on public."%_above_ma" (fetched_at desc);
create index if not exists idx_52w_high_low_fetched_at on public."52w_high_low" (fetched_at desc);
create index if not exists idx_percent_above_ma_50d_timestamp on public."%_above_ma" (above_50d_timestamp desc);
create index if not exists idx_percent_above_ma_200d_timestamp on public."%_above_ma" (above_200d_timestamp desc);

do $$
begin
  if to_regclass('public.market_breadth') is not null then
    execute $sql$
      insert into public."%_above_ma" (
        id,
        above_50d_timestamp, above_50d_open, above_50d_high, above_50d_low, above_50d_close,
        above_200d_timestamp, above_200d_open, above_200d_high, above_200d_low, above_200d_close,
        source_url, content_hash, fetched_at, created_at, updated_at
      )
      select
        id,
        above_50d_timestamp::bigint, above_50d_open, above_50d_high, above_50d_low, above_50d_close,
        above_200d_timestamp::bigint, above_200d_open, above_200d_high, above_200d_low, above_200d_close,
        source_url, content_hash, fetched_at, created_at, updated_at
      from public.market_breadth
      where above_50d_timestamp is not null
        and above_50d_open is not null
        and above_50d_high is not null
        and above_50d_low is not null
        and above_50d_close is not null
        and above_200d_timestamp is not null
        and above_200d_open is not null
        and above_200d_high is not null
        and above_200d_low is not null
        and above_200d_close is not null
      on conflict (id) do nothing
    $sql$;

    execute $sql$
      insert into public."52w_high_low" (
        id, highs_52w, lows_52w, source_url, content_hash, fetched_at, created_at, updated_at
      )
      select id, highs_52w, lows_52w, source_url, content_hash, fetched_at, created_at, updated_at
      from public.market_breadth
      where highs_52w is not null
        and lows_52w is not null
        and highs_52w >= 0
        and lows_52w >= 0
      on conflict (id) do nothing
    $sql$;
  end if;
end $$;
