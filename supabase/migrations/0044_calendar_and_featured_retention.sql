-- One-time production cleanup. Scheduled source refreshes maintain these same
-- rolling windows after this migration is applied.
delete from public.investing_economic_events
where event_time < now() - interval '14 days';

delete from public.unusual_whales_featured_articles
where published_at < now() - interval '7 days';

-- event_date remains useful to calendar reads; event_time makes the rolling
-- timestamp retention delete bounded without scanning the source table.
create index if not exists idx_investing_economic_events_event_time
  on public.investing_economic_events (event_time);
