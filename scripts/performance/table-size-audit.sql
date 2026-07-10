-- Production-safe read-only table and index size inventory for public schema.
select n.nspname as schema, c.relname as table_name, c.reltuples::bigint as estimated_rows, pg_total_relation_size(c.oid) as total_bytes, pg_relation_size(c.oid) as table_bytes, pg_indexes_size(c.oid) as index_bytes, s.seq_scan, s.idx_scan, s.n_live_tup, s.n_dead_tup, s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze
from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid
where c.relkind='r' and n.nspname='public'
order by pg_total_relation_size(c.oid) desc;
