-- Documents/enables the Flow source-table retention update enforced by server-side refresh functions.
-- Dark Pool and Whale Feed now keep a rolling 30-day window by executed_at.
create index if not exists uw_dark_pool_executed_at_retention_30d_idx
  on public.unusual_whales_dark_pool_flows (executed_at desc);

create index if not exists uw_whale_feed_executed_at_retention_30d_idx
  on public.unusual_whales_whale_feed (executed_at desc);
