alter table if exists public.unusual_whales_tracked_institution_activity
  add column if not exists activity_id text;

update public.unusual_whales_tracked_institution_activity
set activity_id = institution_name || '|' || ticker || '|' || report_date::text || '|' || coalesce(security_type, '')
where activity_id is null;

alter table if exists public.unusual_whales_tracked_institution_activity
  alter column activity_id set not null;

alter table if exists public.unusual_whales_tracked_institution_activity
  drop constraint if exists unusual_whales_tracked_institution_activity_pkey;

alter table if exists public.unusual_whales_tracked_institution_activity
  alter column security_type drop not null;

alter table if exists public.unusual_whales_tracked_institution_activity
  add constraint unusual_whales_tracked_institution_activity_pkey primary key (activity_id);

create index if not exists uw_tracked_activity_natural_idx on public.unusual_whales_tracked_institution_activity (institution_name, ticker, report_date, security_type);

notify pgrst, 'reload schema';
