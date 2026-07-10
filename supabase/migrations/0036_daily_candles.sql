create table if not exists public.sp500_daily_candles (
  symbol text not null, provider_symbol text not null, trading_date date not null,
  open numeric not null, high numeric not null, low numeric not null, close numeric not null, previous_close numeric,
  source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (symbol, trading_date),
  constraint sp500_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0),
  constraint sp500_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low)
);
create index if not exists idx_sp500_daily_candles_symbol_date_desc on public.sp500_daily_candles (symbol, trading_date desc);
create index if not exists idx_sp500_daily_candles_date_symbol on public.sp500_daily_candles (trading_date desc, symbol);

create table if not exists public.market_daily_candles (
  symbol text not null, provider_symbol text not null, asset_group text, trading_date date not null,
  open numeric not null, high numeric not null, low numeric not null, close numeric not null, previous_close numeric,
  source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (symbol, trading_date),
  constraint market_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0),
  constraint market_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low)
);
create index if not exists idx_market_daily_candles_symbol_date_desc on public.market_daily_candles (symbol, trading_date desc);
create index if not exists idx_market_daily_candles_date_symbol on public.market_daily_candles (trading_date desc, symbol);

create table if not exists public.crypto_daily_candles (
  symbol text not null, provider_symbol text not null, trading_date date not null,
  open numeric not null, high numeric not null, low numeric not null, close numeric not null, previous_close numeric,
  source text not null, source_timestamp timestamptz, fetched_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (symbol, trading_date),
  constraint crypto_daily_candles_positive_ohlc check (open > 0 and high > 0 and low > 0 and close > 0),
  constraint crypto_daily_candles_valid_ohlc check (high >= open and high >= close and low <= open and low <= close and high >= low)
);
create index if not exists idx_crypto_daily_candles_symbol_date_desc on public.crypto_daily_candles (symbol, trading_date desc);
create index if not exists idx_crypto_daily_candles_date_symbol on public.crypto_daily_candles (trading_date desc, symbol);
