alter table if exists public.unusual_whales_tracked_institutions
  add column if not exists spy_price numeric;
notify pgrst, 'reload schema';
