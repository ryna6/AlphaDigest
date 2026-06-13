alter table put_call_observations add column if not exists cboe_timestamp text;
alter table put_call_observations add column if not exists eastern_timestamp timestamptz;
create unique index if not exists put_call_observations_external_id_key on put_call_observations(external_id);
create index if not exists put_call_observations_ratio_eastern_idx on put_call_observations(ratio_type, eastern_timestamp desc);
