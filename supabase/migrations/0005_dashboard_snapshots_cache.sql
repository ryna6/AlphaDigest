create table if not exists public.dashboard_snapshots (
  key text primary key,
  payload jsonb not null,
  mode text,
  notices jsonb default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  source_hash text,
  metadata jsonb default '{}'::jsonb
);

alter table public.dashboard_snapshots add column if not exists key text;
update public.dashboard_snapshots set key = snapshot_key where key is null and snapshot_key is not null;
alter table public.dashboard_snapshots add column if not exists mode text;
alter table public.dashboard_snapshots add column if not exists notices jsonb default '[]'::jsonb;
alter table public.dashboard_snapshots add column if not exists generated_at timestamptz not null default now();
alter table public.dashboard_snapshots add column if not exists expires_at timestamptz;
alter table public.dashboard_snapshots add column if not exists source_hash text;
alter table public.dashboard_snapshots add column if not exists metadata jsonb default '{}'::jsonb;

create unique index if not exists dashboard_snapshots_key_uidx on public.dashboard_snapshots (key);
create index if not exists dashboard_snapshots_expires_at_idx on public.dashboard_snapshots (expires_at);
create index if not exists dashboard_snapshots_generated_at_idx on public.dashboard_snapshots (generated_at desc);
