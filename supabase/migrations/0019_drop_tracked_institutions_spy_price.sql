alter table if exists public.unusual_whales_tracked_institutions
  drop column if exists spy_price;

notify pgrst, 'reload schema';
