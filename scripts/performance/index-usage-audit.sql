-- Production-safe read-only index inventory for public schema.
select schemaname, relname as table_name, indexrelname as index_name, idx_scan, idx_tup_read, idx_tup_fetch, pg_relation_size(indexrelid) as index_bytes
from pg_stat_user_indexes
where schemaname='public'
order by pg_relation_size(indexrelid) desc, idx_scan asc;
