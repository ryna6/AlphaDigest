create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  function_name text not null,
  source text,
  status text not null check (
    status in ('running', 'success', 'warning', 'error', 'skipped')
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_fetched integer,
  rows_inserted integer,
  rows_updated integer,
  rows_deleted integer,
  error_message text,
  warning_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_function_started_idx
  on public.job_runs (function_name, started_at desc);
create index if not exists job_runs_status_started_idx
  on public.job_runs (status, started_at desc);
create index if not exists job_runs_started_idx
  on public.job_runs (started_at desc);
