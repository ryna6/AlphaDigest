alter table public.unusual_whales_congressional_portfolios
  add column if not exists ids jsonb;

notify pgrst, 'reload schema';
