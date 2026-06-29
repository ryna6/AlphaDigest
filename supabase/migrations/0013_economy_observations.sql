create table if not exists public.economy_observations (
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

create unique index if not exists economy_observations_provider_series_date_uidx
  on public.economy_observations (provider, series_id, date);

create index if not exists economy_observations_metric_date_idx
  on public.economy_observations (provider, metric_key, date desc);

create index if not exists economy_observations_card_date_idx
  on public.economy_observations (provider, card_key, date desc);
