create table if not exists public.unusual_whales_tracked_institution_history (
  institution_slug text not null,
  institution_name text not null,
  report_date date not null,
  total_value numeric,
  spy_price numeric,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_slug, report_date)
);

create index if not exists uw_tracked_institution_history_name_report_idx
  on public.unusual_whales_tracked_institution_history (institution_name, report_date desc);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_updated_at_unusual_whales_tracked_institution_history on public.unusual_whales_tracked_institution_history;
    create trigger set_updated_at_unusual_whales_tracked_institution_history before update on public.unusual_whales_tracked_institution_history for each row execute function set_updated_at();
  end if;
end $$;

notify pgrst, 'reload schema';
