# Supabase runtime-memory audit

Audit date: 2026-09-15

## What can and cannot be concluded

Supabase's Database report defines **Memory Commitment** as Linux `Committed_AS`
compared with `CommitLimit`. It is promised virtual memory, not resident physical
RAM. It can exceed physical RAM without proving that RAM is consumed, but repeated
near-limit spikes increase OOM risk and sustained excess is serious. **Memory Usage**
must instead be interpreted with free memory, cache/buffers, swap, latency and I/O.
High RAM alone can be healthy PostgreSQL/Linux caching.

The repository environment contains no Supabase credentials, Postgres URL, Dashboard
session, metrics export, or Supabase MCP. Consequently the compute tier, RAM,
`Committed_AS`, `CommitLimit`, free/cache memory, swap, CPU, I/O, restarts, latency,
live connections, pool allocations, table sizes, extensions, query statistics and
plans are **not directly verifiable from available tooling**. The supplied warning is
therefore worth monitoring, but it is insufficient to classify physical pressure or
justify compute. Current authoritative references are the [Database reports](https://supabase.com/docs/guides/observability/reports#database),
[connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres),
and [compute sizing](https://supabase.com/docs/guides/platform/compute-add-ons) pages.

## Repository evidence and changes

AlphaDigest has no `pg`, Prisma, Drizzle, Kysely, Postgres URL, port 5432/6543, or
application connection pool dependency. Server code creates `@supabase/supabase-js`
clients and uses the HTTP Data API/PostgREST. Thus Netlify instances do not each
create a direct PostgreSQL pool, and switching this code to Supavisor or setting a
driver pool size would be inapplicable. Supabase's internal PostgREST connections
still count as platform database connections and must be checked in observability.

The stronger repository-level risk was synchronized scheduled work and duplicate
ownership:

* `refresh-news`, `refresh-news-feed`, and `refresh-featured-articles` all fetched and
  upserted the same two source datasets at minutes 0 and 30.
* `refresh-today` re-fetched featured articles every 15 minutes and economic events
  during its weekday window, although dedicated source owners already persist them.
* dark-pool, whale-feed, insider, news, market, heatmap and periodic jobs clustered at
  minute 0. A six-hour boundary additionally started economic and earnings refreshes.

Source owners now run news feed at :06/:36 and featured articles at :07/:37. The news
snapshot reads cached source rows at :08/:38. Today is snapshot-only at
:02/:17/:32/:47. Hourly flow sources run at :01, :02 and :03 before the flow snapshot
at :05. Economic events run at :10 on six-hour boundaries. This preserves freshness
while removing duplicate provider reads/upserts and lowering simultaneous queries.

Recent schema cleanup reduces row width, JSON processing, storage and write volume,
but is not evidence that runtime commitment is resolved. No speculative index,
Postgres setting, extension or infrastructure change is included in this audit.

## Safe production diagnostic runbook

Use SQL Editor/read-only access during both a quiet interval and a former/new cron
burst; retain timestamped output. Do not terminate sessions or change settings.

```sql
show max_connections;
show shared_buffers;
show work_mem;
show maintenance_work_mem;
show autovacuum_max_workers;

select state, usename, application_name, count(*) as connections
from pg_stat_activity where datname = current_database()
group by state, usename, application_name order by connections desc;

select count(*) as total_connections,
  count(*) filter (where state = 'active') as active_connections,
  count(*) filter (where state = 'idle') as idle_connections,
  count(*) filter (where state = 'idle in transaction') as idle_in_transaction
from pg_stat_activity where datname = current_database();

select pid, usename, application_name, state, wait_event_type, wait_event,
  now() - query_start as query_duration, now() - state_change as state_duration,
  left(query, 500) as query
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid()
order by query_duration desc nulls last;

select calls, total_exec_time, mean_exec_time, max_exec_time, rows,
  temp_blks_read, temp_blks_written, shared_blks_read, shared_blks_hit,
  left(query, 1000) as query
from pg_stat_statements order by total_exec_time desc limit 50;

select schemaname, relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_total_relation_size(relid) as total_bytes
from pg_catalog.pg_statio_user_tables order by total_bytes desc;

select pg_size_pretty(pg_database_size(current_database())) as database_size;
select extname, extversion from pg_extension order by extname;
```

If `pg_stat_statements` is unavailable, record that fact; do not enable it solely for
this audit. Correlate Dashboard history for commitment, RAM composition, swap, CPU,
I/O and restarts with Netlify invocation timestamps. Separate brief peaks from a
sustained condition and compare the same market-open and boundary windows for at
least several representative days after deployment.

## Decision and remaining actions

**Compute decision: NOT YET — optimize/monitor first.** There is concrete removable
scheduled concurrency but no telemetry proving sustained physical-memory or swap
pressure. Do not change `max_connections`, `work_mem`, `shared_buffers`, extensions,
Supavisor pool allocation, dedicated pooler, or compute from this evidence alone.
In particular, raising `work_mem` can multiply memory across sort/hash nodes and
concurrent queries, while raising connection limits can increase commitment.

In the Dashboard, record the current compute tier and its documented RAM, then export
at least seven days of Memory Commitment, Memory Usage, Swap, CPU, connections and
disk I/O. Check Database Settings for shared/dedicated pooler allocation and confirm
whether a dedicated pooler is enabled; repository code does not need one. Upgrade only
if, after this deployment, commitment remains close to/above the limit **and** actual
RAM/swap/latency evidence demonstrates persistent constraint that the workload cannot
safely reduce. At that point choose only the next documented compute tier and price it
from the current billing page; current tier and pricing are unknown here, so no amount
is asserted.
