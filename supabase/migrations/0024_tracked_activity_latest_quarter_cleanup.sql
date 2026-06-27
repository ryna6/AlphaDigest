-- Cleanup tracked institution activity rows so each institution keeps only its latest quarter.
-- Idempotent: removes Warrant rows and older report_date rows only from tracked activity.
delete from public.unusual_whales_tracked_institution_activity
where lower(trim(coalesce(security_type, ''))) = 'warrant';

with latest_activity as (
  select institution_name, max(report_date) as latest_report_date
  from public.unusual_whales_tracked_institution_activity
  group by institution_name
)
delete from public.unusual_whales_tracked_institution_activity activity
using latest_activity latest
where activity.institution_name = latest.institution_name
  and activity.report_date < latest.latest_report_date;
