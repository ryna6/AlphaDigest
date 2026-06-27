-- Strict source cache schema cleanup for unused provider columns.
-- Idempotent and safe to rerun.

-- Row-level cleanup before schema changes.
delete from public.unusual_whales_earnings_events
where lower(btrim(coalesce(market_cap_size, ''))) = 'micro';

delete from public.unusual_whales_news_feed
where event_time < now() - interval '3 days';

-- Drop indexes that depend on removed earnings volume/open-interest columns.
drop index if exists public.idx_uw_earnings_oi;
drop index if exists public.idx_uw_earnings_report_date_oi;

alter table public.investing_economic_events
  drop column if exists category,
  drop column if exists source_name,
  drop column if exists country,
  drop column if exists actual_tone,
  drop column if exists "timestamp",
  drop column if exists content_hash;

alter table public.unusual_whales_earnings_events
  drop column if exists country_name,
  drop column if exists country_code,
  drop column if exists has_options,
  drop column if exists open_interest,
  drop column if exists current_price,
  drop column if exists previous_price,
  drop column if exists stock_volume,
  drop column if exists street_mean_estimate,
  drop column if exists eps_mean_estimate,
  drop column if exists last_earnings_date,
  drop column if exists price_last_earnings,
  drop column if exists last_one_day_reactions,
  drop column if exists ending_fiscal_quarter;

alter table public.unusual_whales_featured_articles
  drop column if exists html,
  drop column if exists text_content,
  drop column if exists image,
  drop column if exists created_at,
  drop column if exists updated_source_at,
  drop column if exists author,
  drop column if exists reading_time,
  drop column if exists canonical_url,
  drop column if exists source_name,
  drop column if exists content_text;

alter table public.unusual_whales_news_feed
  drop column if exists created_at,
  drop column if exists url,
  drop column if exists tickers,
  drop column if exists sentiment,
  drop column if exists is_major,
  drop column if exists tags,
  drop column if exists meta,
  drop column if exists why_it_matters,
  drop column if exists category,
  drop column if exists major,
  drop column if exists impact;

notify pgrst, 'reload schema';
