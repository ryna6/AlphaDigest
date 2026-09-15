-- Second source-cache cleanup. Business timestamps remain intact; fetched_at is
-- the single provider-ingestion timestamp for the affected source tables.

-- Congressional ownership has been retired end-to-end.
delete from public.dashboard_snapshots
where key ilike '%congress%'
   or payload::text ilike '%congress%';
delete from public.data_refresh_metadata where source ilike '%congress%';
delete from public.job_runs
where function_name ilike '%congress%' or job_name ilike '%congress%';
drop table if exists public.unusual_whales_congressional_trades cascade;
drop table if exists public.unusual_whales_congressional_portfolios cascade;
drop table if exists public.congressional_trades cascade;

-- Provider candle symbols are identical to the canonical application ticker.
alter table public.crypto_daily_candles drop column if exists provider_symbol;
alter table public.sp500_daily_candles
  drop column if exists provider_symbol,
  drop column if exists source,
  drop column if exists created_at,
  drop column if exists updated_at;

-- Stable provider IDs remain the natural keys for flow rows.
delete from public.unusual_whales_dark_pool_flows where executed_at < now() - interval '14 days';
drop trigger if exists set_updated_at_unusual_whales_dark_pool_flows on public.unusual_whales_dark_pool_flows;
alter table public.unusual_whales_dark_pool_flows
  drop column if exists sentiment,
  drop column if exists nbbo_bid,
  drop column if exists nbbo_ask,
  drop column if exists side,
  drop column if exists created_at,
  drop column if exists updated_at;

drop trigger if exists set_updated_at_unusual_whales_insider_trades on public.unusual_whales_insider_trades;
alter table public.unusual_whales_insider_trades
  drop column if exists created_at,
  drop column if exists updated_at;

drop trigger if exists set_updated_at_unusual_whales_whale_feed on public.unusual_whales_whale_feed;
alter table public.unusual_whales_whale_feed
  drop column if exists created_at,
  drop column if exists updated_at;

-- Earnings retains its deterministic event ID and per-row content hash for
-- overlap-safe upserts/change detection, but not unused provider payload fields.
alter table public.unusual_whales_earnings_events
  drop column if exists market_time,
  drop column if exists sector,
  drop column if exists raw,
  drop column if exists expected_move,
  drop column if exists implied_move,
  drop column if exists updated_at;

alter table public.unusual_whales_featured_articles
  drop column if exists raw,
  drop column if exists content_hash,
  drop column if exists updated_at;
alter table public.unusual_whales_news_feed
  drop column if exists raw,
  drop column if exists content_hash,
  drop column if exists source_name,
  drop column if exists updated_at;

-- Only the latest heatmap observation is retained, so ticker is the natural key.
delete from public.unusual_whales_sp500_heatmap older
using public.unusual_whales_sp500_heatmap newer
where older.ticker = newer.ticker
  and (older.as_of_date, older.fetched_at, older.ctid)
      < (newer.as_of_date, newer.fetched_at, newer.ctid);
alter table public.unusual_whales_sp500_heatmap drop constraint if exists unusual_whales_sp500_heatmap_pkey;
drop index if exists public.idx_unusual_whales_sp500_heatmap_ticker_date;
alter table public.unusual_whales_sp500_heatmap
  drop column if exists id,
  drop column if exists content_hash,
  drop column if exists created_at,
  drop column if exists updated_at;
alter table public.unusual_whales_sp500_heatmap add constraint unusual_whales_sp500_heatmap_pkey primary key (ticker);

-- Sentinel 1970 rows were introduced for legacy rows with no provider report
-- period and are not legitimate 13F quarters. Keep the five most recent provider
-- quarter-ends per investor type to tolerate an incomplete new quarter.
delete from public.unusual_whales_institutional_ticker_flow where report_date < date '1971-01-01';
with retained as (
  select investor_type, report_date,
         dense_rank() over (partition by investor_type order by report_date desc) as quarter_rank
  from public.unusual_whales_institutional_ticker_flow
  group by investor_type, report_date
)
delete from public.unusual_whales_institutional_ticker_flow flow
using retained
where flow.investor_type = retained.investor_type
  and flow.report_date = retained.report_date
  and retained.quarter_rank > 5;

-- Remove lifecycle timestamps and their trigger maintenance; report/activity
-- dates remain the business keys and fetched_at remains freshness metadata.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'unusual_whales_institutional_ticker_flow',
    'unusual_whales_institutional_sector_exposure',
    'unusual_whales_tracked_institutions',
    'unusual_whales_tracked_institution_history',
    'unusual_whales_tracked_institution_holdings',
    'unusual_whales_tracked_institution_options',
    'unusual_whales_tracked_institution_activity'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || table_name, table_name);
    execute format('alter table public.%I drop column if exists created_at, drop column if exists updated_at', table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
