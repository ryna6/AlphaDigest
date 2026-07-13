create table if not exists public.equity_candle_backfill_state (
  job_key text not null,
  symbol text not null,
  table_name text not null check (table_name in ('sp500_daily_candles','market_daily_candles')),
  requested_from date not null,
  requested_to date not null,
  latest_completed_date date,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  attempt_count integer not null default 0,
  last_error text,
  lock_token uuid,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (job_key, symbol, table_name)
);
create index if not exists idx_equity_candle_backfill_state_status on public.equity_candle_backfill_state (job_key, status, updated_at);
