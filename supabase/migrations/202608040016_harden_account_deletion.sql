-- Preserve historical content references without blocking account deletion.

alter table public.firearms
  alter column created_by drop not null,
  drop constraint if exists firearms_created_by_fkey;

alter table public.firearms
  add constraint firearms_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.assessment_releases
  alter column released_by drop not null,
  drop constraint if exists assessment_releases_released_by_fkey;

alter table public.assessment_releases
  add constraint assessment_releases_released_by_fkey
  foreign key (released_by) references public.profiles (id) on delete set null;
