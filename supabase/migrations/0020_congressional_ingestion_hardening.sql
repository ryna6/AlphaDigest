alter table public.unusual_whales_congressional_portfolios
  add column if not exists politician_key text,
  add column if not exists full_name text,
  add column if not exists current_chamber text,
  add column if not exists current_party text,
  add column if not exists current_district text,
  add column if not exists bio text;

update public.unusual_whales_congressional_portfolios
set politician_key = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
where politician_key is null and name is not null;

create unique index if not exists uw_congressional_portfolios_key_uidx on public.unusual_whales_congressional_portfolios (politician_key);

create table if not exists public.unusual_whales_congressional_trades (
  row_key text not null primary key,
  politician_key text not null,
  politician_name text not null,
  symbol text,
  transaction_date date,
  asset text,
  amounts text,
  txn_type text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uw_congressional_trades_politician_idx on public.unusual_whales_congressional_trades (politician_key);
create index if not exists uw_congressional_trades_symbol_date_idx on public.unusual_whales_congressional_trades (symbol, transaction_date desc);
notify pgrst, 'reload schema';
