-- Faculty class lifecycle: archive/restore with retained records, or permanent cascade deletion.

alter table public.classes
  add column if not exists archived_at timestamptz;

create or replace function private.has_active_enrollment(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as enrollment
    join public.classes as class on class.id = enrollment.class_id
    where enrollment.class_id = target_class_id
      and enrollment.student_id = (select auth.uid())
      and enrollment.status = 'active'
      and class.archived_at is null
  );
$$;

create or replace function private.has_any_active_enrollment()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as enrollment
    join public.classes as class on class.id = enrollment.class_id
    where enrollment.student_id = (select auth.uid())
      and enrollment.status = 'active'
      and class.archived_at is null
  );
$$;

create or replace function private.prevent_active_archived_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and exists (
    select 1
    from public.classes
    where id = new.class_id and archived_at is not null
  ) then
    raise exception 'This class is archived and cannot accept active enrollment.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enrollments_prevent_archived_activation
on public.enrollments;
create trigger enrollments_prevent_archived_activation
before insert or update of class_id, status on public.enrollments
for each row execute procedure private.prevent_active_archived_enrollment();

create or replace function private.prevent_open_archived_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_open and exists (
    select 1
    from public.classes
    where id = new.class_id and archived_at is not null
  ) then
    raise exception 'Assessments cannot be opened for an archived class.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists assessment_releases_prevent_archived_open
on public.assessment_releases;
create trigger assessment_releases_prevent_archived_open
before insert or update of class_id, is_open on public.assessment_releases
for each row execute procedure private.prevent_open_archived_assessment();

create or replace function public.set_class_archived(
  target_class_id uuid,
  archive_state boolean
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_class public.classes;
begin
  if not (select private.owns_class(target_class_id)) then
    raise exception 'The selected class is not owned by this Faculty account.'
      using errcode = '42501';
  end if;

  update public.classes
  set archived_at = case when archive_state then now() else null end
  where id = target_class_id
  returning * into updated_class;

  if archive_state then
    update public.enrollments
    set status = 'removed'
    where class_id = target_class_id and status = 'active';

    update public.assessment_releases
    set is_open = false,
        updated_at = now()
    where class_id = target_class_id and is_open;
  end if;

  return updated_class;
end;
$$;

create or replace function public.delete_class_permanently(target_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class public.classes;
  enrollment_count integer;
  attempt_count integer;
begin
  select * into target_class
  from public.classes
  where id = target_class_id
  for update;

  if target_class.id is null or not (select private.owns_class(target_class_id)) then
    raise exception 'The selected class is not owned by this Faculty account.'
      using errcode = '42501';
  end if;

  select count(*) into enrollment_count
  from public.enrollments
  where class_id = target_class_id;

  select count(*) into attempt_count
  from public.assessment_attempts
  where class_id = target_class_id;

  delete from public.classes
  where id = target_class_id;

  return jsonb_build_object(
    'class_name', target_class.name,
    'deleted_enrollments', enrollment_count,
    'deleted_attempts', attempt_count
  );
end;
$$;

revoke all on function private.prevent_active_archived_enrollment()
from public, anon, authenticated;
revoke all on function private.prevent_open_archived_assessment()
from public, anon, authenticated;
revoke all on function public.set_class_archived(uuid, boolean)
from public, anon;
revoke all on function public.delete_class_permanently(uuid)
from public, anon;
grant execute on function public.set_class_archived(uuid, boolean)
to authenticated;
grant execute on function public.delete_class_permanently(uuid)
to authenticated;
