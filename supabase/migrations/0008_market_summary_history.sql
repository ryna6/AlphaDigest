create table if not exists public.market_summary_history (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  value numeric not null,
  observed_at timestamptz not null,
  source text not null,
  freshness text,
  created_at timestamptz not null default now()
);

create index if not exists market_summary_history_metric_observed_idx
  on public.market_summary_history(metric_key, observed_at desc);

create index if not exists market_summary_history_observed_idx
  on public.market_summary_history(observed_at desc);
