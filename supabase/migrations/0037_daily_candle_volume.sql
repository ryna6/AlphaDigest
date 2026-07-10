alter table public.sp500_daily_candles
  add column if not exists volume numeric;

alter table public.market_daily_candles
  add column if not exists volume numeric;

alter table public.crypto_daily_candles
  add column if not exists volume numeric;
