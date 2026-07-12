alter table if exists public.unusual_whales_institutional_ticker_flow
  add column if not exists report_date date;

-- Legacy rows predate provider report-date persistence. They receive a sentinel
-- quarter that is filtered out by application completeness checks; new rows must
-- be written with the provider-supplied report_date.
update public.unusual_whales_institutional_ticker_flow
set report_date = date '1970-01-01'
where report_date is null;

alter table if exists public.unusual_whales_institutional_ticker_flow
  alter column report_date set not null;

alter table if exists public.unusual_whales_institutional_ticker_flow
  drop constraint if exists unusual_whales_institutional_ticker_flow_pkey;

alter table if exists public.unusual_whales_institutional_ticker_flow
  add primary key (investor_type, "order", ticker, report_date);

drop index if exists public.uw_institutional_ticker_flow_type_order_value_idx;
create index if not exists uw_institutional_ticker_flow_type_order_report_value_idx
  on public.unusual_whales_institutional_ticker_flow (investor_type, "order", report_date desc, value desc);

notify pgrst, 'reload schema';
