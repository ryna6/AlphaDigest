alter table if exists public.unusual_whales_tracked_institution_holdings
  add column if not exists close numeric;
