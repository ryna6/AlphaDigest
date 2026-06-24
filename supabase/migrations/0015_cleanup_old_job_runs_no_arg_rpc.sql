-- Ensure scheduled server jobs can call job_runs retention through a no-argument RPC.
-- Supabase projects may need a PostgREST schema-cache reload after this migration before rpc() sees the signature.
create or replace function public.cleanup_old_job_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.job_runs
  where started_at < now() - interval '24 hours';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_job_runs() from public;
revoke all on function public.cleanup_old_job_runs() from anon;
grant execute on function public.cleanup_old_job_runs() to service_role;
