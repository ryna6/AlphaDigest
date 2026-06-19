alter table put_call_observations add column if not exists source_timezone text;
alter table put_call_observations add column if not exists display_timezone text;
alter table put_call_observations add column if not exists source_as_of_central text;
alter table put_call_observations add column if not exists as_of_eastern timestamptz;
alter table put_call_observations add column if not exists scraped_at timestamptz;
create unique index if not exists put_call_observations_external_id_key on put_call_observations(external_id);
create index if not exists put_call_observations_ratio_as_of_eastern_idx on put_call_observations(ratio_type, as_of_eastern desc);
