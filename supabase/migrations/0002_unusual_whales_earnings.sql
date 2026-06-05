create table if not exists unusual_whales_earnings_events (
  id text primary key,
  symbol text not null,
  company_name text,
  logo text,
  report_date date not null,
  report_time text,
  market_time text,
  sector text,
  country_code text,
  country_name text,
  is_sp500 boolean,
  has_options boolean,
  market_cap_size text,
  market_cap numeric,
  current_price numeric,
  previous_price numeric,
  open_interest bigint,
  call_volume bigint,
  put_volume bigint,
  stock_volume bigint,
  expected_move numeric,
  implied_move numeric,
  street_mean_estimate numeric,
  eps_mean_estimate numeric,
  last_earnings_date date,
  price_last_earnings numeric,
  last_one_day_reactions jsonb,
  ending_fiscal_quarter date,
  raw jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_uw_earnings_report_date
on unusual_whales_earnings_events (report_date);

create index if not exists idx_uw_earnings_symbol
on unusual_whales_earnings_events (symbol);

create index if not exists idx_uw_earnings_oi
on unusual_whales_earnings_events (open_interest desc);

create index if not exists idx_uw_earnings_report_date_oi
on unusual_whales_earnings_events (report_date, open_interest desc);

create table if not exists data_refresh_metadata (
  source text primary key,
  ok boolean not null,
  fetched_at timestamptz not null,
  changed boolean,
  row_count integer,
  content_hash text,
  error text,
  meta jsonb
);
