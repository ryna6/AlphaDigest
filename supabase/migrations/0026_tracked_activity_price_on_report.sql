alter table if exists public.unusual_whales_tracked_institution_activity
  add column if not exists price_on_report numeric;
