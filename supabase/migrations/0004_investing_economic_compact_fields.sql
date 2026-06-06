alter table investing_economic_events
  add column if not exists unit text,
  add column if not exists reference_period text;
