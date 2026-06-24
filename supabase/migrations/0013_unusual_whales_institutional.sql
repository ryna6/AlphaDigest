create table if not exists public.unusual_whales_institutional_ticker_flow (
  investor_type text not null,
  "order" text not null,
  ticker text not null,
  value numeric,
  increased_positions numeric,
  decreased_positions numeric,
  holding_count numeric,
  units numeric,
  prev_units_change numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (investor_type, "order", ticker)
);
create index if not exists uw_institutional_ticker_flow_type_order_value_idx on public.unusual_whales_institutional_ticker_flow (investor_type, "order", value desc);

create table if not exists public.unusual_whales_institutional_sector_exposure (
  investor_type text not null,
  sector text not null,
  value numeric,
  report_date date not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (investor_type, sector, report_date)
);
create index if not exists uw_institutional_sector_type_report_idx on public.unusual_whales_institutional_sector_exposure (investor_type, report_date desc);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_updated_at_unusual_whales_institutional_ticker_flow on public.unusual_whales_institutional_ticker_flow;
    create trigger set_updated_at_unusual_whales_institutional_ticker_flow before update on public.unusual_whales_institutional_ticker_flow for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_unusual_whales_institutional_sector_exposure on public.unusual_whales_institutional_sector_exposure;
    create trigger set_updated_at_unusual_whales_institutional_sector_exposure before update on public.unusual_whales_institutional_sector_exposure for each row execute function set_updated_at();
  end if;
end $$;
notify pgrst, 'reload schema';
