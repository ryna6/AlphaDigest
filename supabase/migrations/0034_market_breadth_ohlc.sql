alter table public.market_breadth
  add column if not exists above_50d_timestamp numeric,
  add column if not exists above_50d_open numeric,
  add column if not exists above_50d_high numeric,
  add column if not exists above_50d_low numeric,
  add column if not exists above_50d_close numeric,
  add column if not exists above_200d_timestamp numeric,
  add column if not exists above_200d_open numeric,
  add column if not exists above_200d_high numeric,
  add column if not exists above_200d_low numeric,
  add column if not exists above_200d_close numeric;

update public.market_breadth
set
  above_50d_open = coalesce(above_50d_open, above_50d_percent),
  above_50d_high = coalesce(above_50d_high, above_50d_percent),
  above_50d_low = coalesce(above_50d_low, above_50d_percent),
  above_50d_close = coalesce(above_50d_close, above_50d_percent),
  above_200d_open = coalesce(above_200d_open, above_200d_percent),
  above_200d_high = coalesce(above_200d_high, above_200d_percent),
  above_200d_low = coalesce(above_200d_low, above_200d_percent),
  above_200d_close = coalesce(above_200d_close, above_200d_percent)
where id = 'sp500';
