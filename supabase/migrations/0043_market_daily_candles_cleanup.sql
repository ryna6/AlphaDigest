-- Asset classification is reconstructible from lib/data/market-assets.ts and
-- is not part of candle identity, retention, routing, or API reads.
alter table public.market_daily_candles drop column if exists asset_group;

notify pgrst, 'reload schema';
