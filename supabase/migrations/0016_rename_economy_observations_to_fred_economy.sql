do $$
begin
  if to_regclass('public.fred_economy') is null and to_regclass('public.economy_observations') is not null then
    alter table public.economy_observations rename to fred_economy;
  end if;
end $$;

create table if not exists public.fred_economy (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fred',
  series_id text not null,
  metric_key text not null,
  card_key text not null,
  date date not null,
  value numeric not null,
  unit text,
  frequency text,
  seasonal_adjustment text,
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fred_economy_provider_series_date_uidx
  on public.fred_economy (provider, series_id, date);

do $$
begin
  if to_regclass('public.economy_observations') is not null then
    execute $sql$
      insert into public.fred_economy (
        id, provider, series_id, metric_key, card_key, date, value, unit, frequency, seasonal_adjustment, source_label, created_at, updated_at
      )
      select
        id, provider, series_id, metric_key, card_key, date, value, unit, frequency, seasonal_adjustment, source_label, created_at, updated_at
      from public.economy_observations
      on conflict (provider, series_id, date) do update set
        metric_key = excluded.metric_key,
        card_key = excluded.card_key,
        value = excluded.value,
        unit = excluded.unit,
        frequency = excluded.frequency,
        seasonal_adjustment = excluded.seasonal_adjustment,
        source_label = excluded.source_label,
        updated_at = excluded.updated_at
    $sql$;
  end if;
end $$;

drop index if exists public.economy_observations_provider_series_date_uidx;
drop index if exists public.economy_observations_metric_date_idx;
drop index if exists public.economy_observations_card_date_idx;

create index if not exists fred_economy_metric_date_idx
  on public.fred_economy (provider, metric_key, date desc);

create index if not exists fred_economy_card_date_idx
  on public.fred_economy (provider, card_key, date desc);
