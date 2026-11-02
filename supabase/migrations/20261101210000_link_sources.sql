-- Link sources (CECS491-84): a source can be a web page, not only an uploaded file.
-- A link has a url and no file; a file source has a storage_path and no url.

-- The inline check on `kind` got Postgres's default name, sources_kind_check.
alter table public.sources drop constraint sources_kind_check;

alter table public.sources
  add constraint sources_kind_check check (kind in ('pdf', 'text', 'link'));

-- Where a link points. http(s) only; the app normalizes it before inserting.
alter table public.sources
  add column url text
    check (char_length(url) between 1 and 2048 and url ~ '^https?://');

-- A link has no file in the bucket. The unique constraint still holds for files:
-- Postgres lets any number of rows share a null.
alter table public.sources alter column storage_path drop not null;

-- Exactly one location per source: a file, or a link.
alter table public.sources
  add constraint sources_location_check check (
    (kind = 'link' and url is not null and storage_path is null)
    or (kind <> 'link' and storage_path is not null and url is null)
  );

-- Users add a link the way they add a file: by inserting the row. Status, errors, and
-- metadata stay the worker's.
grant insert (url) on table public.sources to authenticated;
