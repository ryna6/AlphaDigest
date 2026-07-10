-- Production-safe read-only query stats. Requires pg_stat_statements access.
select queryid, calls, total_exec_time, mean_exec_time, rows, shared_blks_hit, shared_blks_read, left(regexp_replace(query, '\\s+', ' ', 'g'), 500) as query_sample
from pg_stat_statements
where dbid = (select oid from pg_database where datname = current_database())
order by total_exec_time desc
limit 50;
