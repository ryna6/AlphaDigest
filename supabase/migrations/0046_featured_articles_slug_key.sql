-- The provider slug is the persisted article identity and the application route key.
-- The former id was only a locally generated "uw-featured:" copy of that slug.
alter table public.unusual_whales_featured_articles
  drop constraint if exists unusual_whales_featured_articles_pkey;

drop index if exists public.idx_uw_featured_articles_id;

alter table public.unusual_whales_featured_articles
  alter column slug set not null,
  add constraint unusual_whales_featured_articles_pkey primary key (slug),
  drop column if exists id;

notify pgrst, 'reload schema';
