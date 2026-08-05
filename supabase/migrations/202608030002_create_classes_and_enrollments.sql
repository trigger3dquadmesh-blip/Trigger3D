-- Trigger3D classes and student enrollment workflow.
-- Requires 202608030001_create_profiles_and_roles.sql.

do $$
begin
  create type public.enrollment_status as enum ('active', 'removed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 100),
  code text not null unique check (code = upper(code)),
  created_at timestamptz not null default now(),
  constraint classes_faculty_id_fkey
    foreign key (faculty_id) references public.profiles (id) on delete cascade
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  student_id uuid not null,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_class_id_fkey
    foreign key (class_id) references public.classes (id) on delete cascade,
  constraint enrollments_student_id_fkey
    foreign key (student_id) references public.profiles (id) on delete cascade,
  constraint enrollments_class_student_key unique (class_id, student_id)
);

create unique index if not exists one_active_class_per_student
on public.enrollments (student_id)
where status = 'active';

create index if not exists classes_faculty_id_idx
on public.classes (faculty_id);

create index if not exists enrollments_class_id_idx
on public.enrollments (class_id);

create index if not exists enrollments_student_id_idx
on public.enrollments (student_id);

alter table public.classes enable row level security;
alter table public.enrollments enable row level security;

revoke all on table public.classes from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
grant select on table public.classes to authenticated;
grant select on table public.enrollments to authenticated;

create or replace function private.owns_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes
    where id = target_class_id
      and faculty_id = (select auth.uid())
  );
$$;

create or replace function private.has_active_enrollment(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments
    where class_id = target_class_id
      and student_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.faculty_can_view_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as enrollment
    join public.classes as class
      on class.id = enrollment.class_id
    where enrollment.student_id = target_student_id
      and class.faculty_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_class(uuid) from public;
revoke all on function private.has_active_enrollment(uuid) from public;
revoke all on function private.faculty_can_view_student(uuid) from public;
grant execute on function private.owns_class(uuid) to authenticated;
grant execute on function private.has_active_enrollment(uuid) to authenticated;
grant execute on function private.faculty_can_view_student(uuid) to authenticated;

drop policy if exists "Faculty can view their classes" on public.classes;
create policy "Faculty can view their classes"
on public.classes
for select
to authenticated
using (faculty_id = (select auth.uid()));

drop policy if exists "Students can view their active class" on public.classes;
create policy "Students can view their active class"
on public.classes
for select
to authenticated
using ((select private.has_active_enrollment(id)));

drop policy if exists "Admins can view all classes" on public.classes;
create policy "Admins can view all classes"
on public.classes
for select
to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "Students can view their enrollment history" on public.enrollments;
create policy "Students can view their enrollment history"
on public.enrollments
for select
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "Faculty can view enrollment in their classes" on public.enrollments;
create policy "Faculty can view enrollment in their classes"
on public.enrollments
for select
to authenticated
using ((select private.owns_class(class_id)));

drop policy if exists "Admins can view all enrollments" on public.enrollments;
create policy "Admins can view all enrollments"
on public.enrollments
for select
to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "Faculty can view profiles of their students" on public.profiles;
create policy "Faculty can view profiles of their students"
on public.profiles
for select
to authenticated
using ((select private.faculty_can_view_student(id)));

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute procedure public.set_updated_at();

create or replace function public.create_class(class_name text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := trim(class_name);
  generated_code text;
  created_class public.classes;
begin
  if (select private.current_user_role()) is distinct from 'faculty' then
    raise exception 'Only Faculty accounts can create classes.'
      using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 100 then
    raise exception 'Class names must contain between 2 and 100 characters.'
      using errcode = '22023';
  end if;

  loop
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.classes (faculty_id, name, code)
      values ((select auth.uid()), normalized_name, generated_code)
      returning * into created_class;

      return created_class;
    exception
      when unique_violation then
        -- Generate another code if an extremely unlikely collision occurs.
    end;
  end loop;
end;
$$;

create or replace function public.join_class(class_code text)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(trim(class_code));
  target_class public.classes;
  existing_enrollment public.enrollments;
  created_enrollment public.enrollments;
begin
  if (select private.current_user_role()) is distinct from 'student' then
    raise exception 'Only Student accounts can join classes.'
      using errcode = '42501';
  end if;

  select * into target_class
  from public.classes
  where code = normalized_code;

  if target_class.id is null then
    raise exception 'Class code not found.' using errcode = 'P0002';
  end if;

  select * into existing_enrollment
  from public.enrollments
  where class_id = target_class.id
    and student_id = (select auth.uid());

  if existing_enrollment.status = 'removed' then
    raise exception 'You have been removed from this class. Contact your instructor to be re-added.'
      using errcode = '42501';
  end if;

  if existing_enrollment.status = 'active' then
    return existing_enrollment;
  end if;

  if exists (
    select 1
    from public.enrollments
    where student_id = (select auth.uid())
      and status = 'active'
  ) then
    raise exception 'You are already enrolled in an active class.'
      using errcode = '23505';
  end if;

  begin
    insert into public.enrollments (class_id, student_id, status)
    values (target_class.id, (select auth.uid()), 'active')
    returning * into created_enrollment;
  exception
    when unique_violation then
      raise exception 'You are already enrolled in an active class.'
        using errcode = '23505';
  end;

  return created_enrollment;
end;
$$;

create or replace function public.set_enrollment_status(
  target_enrollment_id uuid,
  new_status public.enrollment_status
)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_enrollment public.enrollments;
  updated_enrollment public.enrollments;
begin
  select * into target_enrollment
  from public.enrollments
  where id = target_enrollment_id;

  if target_enrollment.id is null
    or not (select private.owns_class(target_enrollment.class_id)) then
    raise exception 'Enrollment not found or not owned by this Faculty account.'
      using errcode = '42501';
  end if;

  begin
    update public.enrollments
    set status = new_status
    where id = target_enrollment_id
    returning * into updated_enrollment;
  exception
    when unique_violation then
      raise exception 'This student is already active in another class.'
        using errcode = '23505';
  end;

  return updated_enrollment;
end;
$$;

revoke all on function public.create_class(text) from public, anon;
revoke all on function public.join_class(text) from public, anon;
revoke all on function public.set_enrollment_status(uuid, public.enrollment_status)
from public, anon;
grant execute on function public.create_class(text) to authenticated;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.set_enrollment_status(uuid, public.enrollment_status)
to authenticated;
