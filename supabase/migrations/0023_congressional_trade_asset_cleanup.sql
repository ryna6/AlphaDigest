-- Safe Congressional trade asset cleanup.
-- Removes only explicitly disallowed asset values after trim/lower normalization.
-- Null, empty, and missing asset values are intentionally retained because some valid
-- stock/option Congressional trades arrive without an asset type.
delete from public.unusual_whales_congressional_trades
where asset is not null
  and lower(trim(asset)) in ('bond', 'corporate bond', 'municipal-security', 'other');
