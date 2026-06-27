-- Cleanup cached Congressional trade rows that should no longer be retained.
-- Idempotent: only disallowed asset types and rows older than the rolling 3-year window are removed.
delete from public.unusual_whales_congressional_trades
where lower(trim(coalesce(asset, ''))) in ('bond', 'corporate bond', 'municipal-security', 'other')
   or transaction_date < (current_date - interval '3 years')::date;
