-- Prune cached Unusual Whales earnings rows to the active previous/current/next-week window.
-- Idempotent and safe to rerun; ongoing pruning is also enforced by fetch-uw-earnings.

with active_window as (
  select
    (((now() at time zone 'America/Toronto')::date - (((extract(dow from (now() at time zone 'America/Toronto')::date)::int + 6) % 7) * interval '1 day')) - interval '7 days')::date as min_date,
    (((now() at time zone 'America/Toronto')::date - (((extract(dow from (now() at time zone 'America/Toronto')::date)::int + 6) % 7) * interval '1 day')) + interval '11 days')::date as max_date
)
delete from public.unusual_whales_earnings_events earnings
using active_window
where earnings.report_date < active_window.min_date
   or earnings.report_date > active_window.max_date
   or lower(btrim(coalesce(earnings.market_cap_size, ''))) = 'micro';

notify pgrst, 'reload schema';
