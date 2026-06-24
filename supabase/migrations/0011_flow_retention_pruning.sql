-- Documents the Flow source-table retention windows enforced by server-side refresh functions.
-- Whale Feed preserves recent delayed free-plan rows for 14 days and prunes only older rows.
-- Insider Trades keeps the same 6-month transaction_date window used by readers and refresh filtering.

create index if not exists uw_whale_feed_executed_at_retention_idx
  on public.unusual_whales_whale_feed (executed_at desc);

create index if not exists uw_insider_transaction_date_retention_idx
  on public.unusual_whales_insider_trades (transaction_date desc);

notify pgrst, 'reload schema';
