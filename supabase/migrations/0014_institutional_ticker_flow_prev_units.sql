alter table if exists public.unusual_whales_institutional_ticker_flow
  add column if not exists prev_units numeric;

alter table if exists public.unusual_whales_institutional_ticker_flow
  drop column if exists prev_units_change;

notify pgrst, 'reload schema';
