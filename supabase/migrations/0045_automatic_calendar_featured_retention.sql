-- A service-role-only, idempotent retention operation invoked by the daily
-- cleanup-source-retention scheduled function. Source rows have no inbound
-- foreign keys; dashboard snapshots contain independent JSON payloads.
create or replace function public.cleanup_calendar_and_featured_retention()
returns table(economic_events_deleted bigint, featured_articles_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  economic_count bigint;
  featured_count bigint;
begin
  delete from public.investing_economic_events
  where event_time < now() - interval '14 days';
  get diagnostics economic_count = row_count;

  delete from public.unusual_whales_featured_articles
  where published_at < now() - interval '7 days';
  get diagnostics featured_count = row_count;

  return query select economic_count, featured_count;
end;
$$;

revoke all on function public.cleanup_calendar_and_featured_retention() from public;
revoke all on function public.cleanup_calendar_and_featured_retention() from anon;
revoke all on function public.cleanup_calendar_and_featured_retention() from authenticated;
grant execute on function public.cleanup_calendar_and_featured_retention() to service_role;
