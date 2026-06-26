create table if not exists public.unusual_whales_congressional_portfolios (
  name text not null primary key,
  ytd_return numeric,
  rank integer not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uw_congressional_portfolios_rank_idx on public.unusual_whales_congressional_portfolios (rank asc);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_updated_at_unusual_whales_congressional_portfolios on public.unusual_whales_congressional_portfolios;
    create trigger set_updated_at_unusual_whales_congressional_portfolios before update on public.unusual_whales_congressional_portfolios for each row execute function set_updated_at();
  end if;
end $$;
notify pgrst, 'reload schema';
