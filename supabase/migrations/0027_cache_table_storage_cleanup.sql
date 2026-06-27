-- Clean cached provider tables after adapters stop reading/writing removed columns.
-- Idempotent and safe to rerun.

delete from public.unusual_whales_earnings_events
where lower(btrim(coalesce(market_cap_size, ''))) = 'micro';

delete from public.unusual_whales_news_feed
where event_time < now() - interval '3 days';

alter table public.unusual_whales_earnings_events
  drop column if exists country_name,
  drop column if exists current_price,
  drop column if exists previous_price,
  drop column if exists stock_volume,
  drop column if exists last_earnings_date,
  drop column if exists price_last_earnings,
  drop column if exists last_one_day_reactions,
  drop column if exists ending_fiscal_quarter;

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

alter table public.investing_economic_events
  drop column if exists country,
  drop column if exists source_name;

-- Keep article content_html and image_url: Top News detail/list rendering uses them.
-- Keep news_feed.event_time: it is the retention/order timestamp for the 3-day cache.

notify pgrst, 'reload schema';
