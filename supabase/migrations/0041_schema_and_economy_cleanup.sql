-- Remove retired Economy/FRED storage and application-unused cache metadata.
-- Application readers and writers no longer reference these fields before this migration is applied.

delete from public.dashboard_snapshots where key = 'economy:latest';
delete from public.data_refresh_metadata
where source in ('fred_economy', 'economy', 'dashboard_snapshot:economy:latest', 'economy:latest');
delete from public.job_runs
where function_name = 'refresh-economy' or source = 'FRED';

drop table if exists public.fred_economy;

alter table public.dashboard_snapshots
  drop column if exists source_hash;

alter table public.crypto_daily_candles
  drop column if exists previous_close,
  drop column if exists source,
  drop column if exists source_timestamp,
  drop column if exists created_at,
  drop column if exists updated_at;

alter table public.market_daily_candles
  drop column if exists source_timestamp,
  drop column if exists created_at,
  drop column if exists updated_at;

alter table public.investing_economic_events
  drop column if exists time,
  drop column if exists raw,
  drop column if exists source_url,
  drop column if exists updated_at;

-- Yahoo Finance is the table's only writer. Symbol is its natural conflict key.
delete from public.market_quotes a
using public.market_quotes b
where a.symbol = b.symbol
  and (a.fetched_at, a.ctid) < (b.fetched_at, b.ctid);
drop index if exists public.idx_market_quotes_symbol_source;
alter table public.market_quotes drop constraint if exists market_quotes_pkey;
drop index if exists public.idx_market_quotes_id;
alter table public.market_quotes
  drop column if exists id,
  drop column if exists source,
  drop column if exists raw,
  drop column if exists content_hash,
  drop column if exists updated_at;
alter table public.market_quotes alter column symbol set not null;
alter table public.market_quotes add constraint market_quotes_pkey primary key (symbol);

alter table public.job_runs
  drop column if exists created_at;

alter table public.market_summary_history
  drop column if exists created_at;

notify pgrst, 'reload schema';
