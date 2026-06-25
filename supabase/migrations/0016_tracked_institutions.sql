create table if not exists public.unusual_whales_tracked_institutions (
  institution_name text not null,
  provider_name text not null,
  slug text not null,
  short_name text,
  description text,
  people jsonb,
  total_value numeric,
  report_date date not null,
  buy_value numeric,
  sell_value numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_name, report_date)
);
create index if not exists uw_tracked_institutions_report_idx on public.unusual_whales_tracked_institutions (institution_name, report_date desc);

create table if not exists public.unusual_whales_tracked_institution_holdings (
  institution_name text not null,
  report_date date not null,
  ticker text not null,
  full_name text,
  units numeric,
  avg_price numeric,
  units_change numeric,
  change_perc numeric,
  perc_of_share_value numeric,
  value numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_name, report_date, ticker)
);
create index if not exists uw_tracked_holdings_value_idx on public.unusual_whales_tracked_institution_holdings (institution_name, report_date desc, value desc);

create table if not exists public.unusual_whales_tracked_institution_options (
  institution_name text not null,
  as_of_date date not null,
  ticker text not null,
  units numeric,
  full_name text,
  put_call text,
  put_oi numeric,
  call_oi numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_name, as_of_date, ticker, put_call)
);
create index if not exists uw_tracked_options_units_idx on public.unusual_whales_tracked_institution_options (institution_name, as_of_date desc, units desc);

create table if not exists public.unusual_whales_tracked_institution_activity (
  institution_name text not null,
  ticker text not null,
  report_date date not null,
  units numeric,
  units_change numeric,
  security_type text,
  buy_price numeric,
  sell_price numeric,
  close numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_name, ticker, report_date, security_type)
);
create index if not exists uw_tracked_activity_report_idx on public.unusual_whales_tracked_institution_activity (institution_name, report_date desc);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_updated_at_unusual_whales_tracked_institutions on public.unusual_whales_tracked_institutions;
    create trigger set_updated_at_unusual_whales_tracked_institutions before update on public.unusual_whales_tracked_institutions for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_unusual_whales_tracked_institution_holdings on public.unusual_whales_tracked_institution_holdings;
    create trigger set_updated_at_unusual_whales_tracked_institution_holdings before update on public.unusual_whales_tracked_institution_holdings for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_unusual_whales_tracked_institution_options on public.unusual_whales_tracked_institution_options;
    create trigger set_updated_at_unusual_whales_tracked_institution_options before update on public.unusual_whales_tracked_institution_options for each row execute function set_updated_at();
    drop trigger if exists set_updated_at_unusual_whales_tracked_institution_activity on public.unusual_whales_tracked_institution_activity;
    create trigger set_updated_at_unusual_whales_tracked_institution_activity before update on public.unusual_whales_tracked_institution_activity for each row execute function set_updated_at();
  end if;
end $$;
notify pgrst, 'reload schema';
