create table if not exists public.unusual_whales_dark_pool_flows (
  external_id text primary key,
  executed_at timestamptz not null,
  ticker text not null,
  sector text,
  price numeric,
  premium numeric,
  volume numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uw_dark_pool_executed_at_idx on public.unusual_whales_dark_pool_flows (executed_at desc);
create index if not exists uw_dark_pool_ticker_executed_at_idx on public.unusual_whales_dark_pool_flows (ticker, executed_at desc);
create table if not exists public.unusual_whales_insider_trades (
  external_id text primary key,
  ticker text not null,
  sector text,
  amount numeric,
  transaction_date date not null,
  price numeric,
  owner_name text,
  officer_title text,
  transaction_code text,
  shares_owned_after numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uw_insider_transaction_date_idx on public.unusual_whales_insider_trades (transaction_date desc);
create index if not exists uw_insider_ticker_transaction_date_idx on public.unusual_whales_insider_trades (ticker, transaction_date desc);
create index if not exists uw_insider_transaction_code_idx on public.unusual_whales_insider_trades (transaction_code);
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_updated_at_unusual_whales_dark_pool_flows on public.unusual_whales_dark_pool_flows;
    create trigger set_updated_at_unusual_whales_dark_pool_flows before update on public.unusual_whales_dark_pool_flows for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_unusual_whales_insider_trades on public.unusual_whales_insider_trades;
    create trigger set_updated_at_unusual_whales_insider_trades before update on public.unusual_whales_insider_trades for each row execute function set_updated_at();
  end if;
end $$;
notify pgrst, 'reload schema';
