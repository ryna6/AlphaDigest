-- Claiming must happen in PostgreSQL, not in a select-then-update worker race.
create or replace function public.claim_equity_candle_backfill_batch(
  p_job_key text, p_limit integer, p_lock_token uuid, p_lock_timeout_minutes integer default 30
) returns setof public.equity_candle_backfill_state
language plpgsql security definer set search_path = public as $$
begin
  update public.equity_candle_backfill_state
     set status = 'pending', lock_token = null, locked_at = null, updated_at = now(),
         last_error = coalesce(last_error, 'stale lock released')
   where job_key = p_job_key and status = 'running'
     and locked_at < now() - make_interval(mins => p_lock_timeout_minutes);

  return query
  with candidates as (
    select job_key, symbol, table_name
      from public.equity_candle_backfill_state
     where job_key = p_job_key and status in ('pending', 'failed')
     order by requested_to, updated_at, symbol
     for update skip locked
     limit greatest(1, least(p_limit, 5))
  )
  update public.equity_candle_backfill_state s
     set status = 'running', lock_token = p_lock_token, locked_at = now(),
         started_at = coalesce(s.started_at, now()), attempt_count = s.attempt_count + 1,
         updated_at = now()
    from candidates c
   where (s.job_key, s.symbol, s.table_name) = (c.job_key, c.symbol, c.table_name)
  returning s.*;
end $$;

grant execute on function public.claim_equity_candle_backfill_batch(text, integer, uuid, integer) to service_role;
