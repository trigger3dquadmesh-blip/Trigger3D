begin;

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint academic_terms_year_format check (academic_year ~ '^\d{4}-\d{4}$'),
  constraint academic_terms_semester_check check (semester in ('1st Semester', '2nd Semester')),
  constraint academic_terms_date_order check (end_date >= start_date),
  constraint academic_terms_status_check check (status in ('planned', 'active', 'closed')),
  unique (academic_year, semester)
);

alter table public.academic_terms enable row level security;

drop policy if exists "Authenticated users can read academic terms" on public.academic_terms;
create policy "Authenticated users can read academic terms"
on public.academic_terms for select to authenticated using (true);

alter table public.classes add column if not exists term text not null default 'Current term';
alter table public.classes add column if not exists end_date date;
alter table public.classes add column if not exists academic_term_id uuid references public.academic_terms(id) on delete restrict;
alter table public.classes add column if not exists subject_name text;
alter table public.classes add column if not exists section text;

create index if not exists classes_academic_term_idx on public.classes (academic_term_id);
create index if not exists classes_faculty_term_idx on public.classes (faculty_id, academic_term_id);

create or replace function public.refresh_expired_academic_terms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare closed_count integer;
begin
  update public.classes
  set archived_at = coalesce(archived_at, now())
  where academic_term_id in (
    select id from public.academic_terms where status = 'active' and end_date < current_date
  );

  update public.academic_terms
  set status = 'closed', closed_at = coalesce(closed_at, now())
  where status = 'active' and end_date < current_date;
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

create or replace function public.admin_create_academic_term(
  term_academic_year text,
  term_semester text,
  term_start_date date,
  term_end_date date,
  make_active boolean default false
)
returns public.academic_terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_year text := trim(term_academic_year);
  normalized_semester text := trim(term_semester);
  created_term public.academic_terms;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only administrators can manage academic terms.' using errcode = '42501';
  end if;
  if normalized_year !~ '^\d{4}-\d{4}$'
    or substring(normalized_year from 6 for 4)::integer <> substring(normalized_year from 1 for 4)::integer + 1 then
    raise exception 'Academic year must contain consecutive years, such as 2026-2027.' using errcode = '22023';
  end if;
  if normalized_semester not in ('1st Semester', '2nd Semester') then
    raise exception 'Select either 1st Semester or 2nd Semester.' using errcode = '22023';
  end if;
  if term_start_date is null or term_end_date is null or term_end_date < term_start_date then
    raise exception 'Enter a valid term date range.' using errcode = '22023';
  end if;

  if make_active then
    update public.academic_terms set status = 'closed', closed_at = coalesce(closed_at, now()) where status = 'active';
    update public.classes set archived_at = coalesce(archived_at, now())
      where academic_term_id in (select id from public.academic_terms where status = 'closed');
  end if;

  insert into public.academic_terms (academic_year, semester, start_date, end_date, status, created_by)
  values (normalized_year, normalized_semester, term_start_date, term_end_date, case when make_active then 'active' else 'planned' end, auth.uid())
  returning * into created_term;
  return created_term;
end;
$$;

create or replace function public.admin_set_academic_term_status(target_term_id uuid, new_status text)
returns public.academic_terms
language plpgsql
security definer
set search_path = ''
as $$
declare updated_term public.academic_terms;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only administrators can manage academic terms.' using errcode = '42501';
  end if;
  if new_status not in ('planned', 'active', 'closed') then
    raise exception 'Invalid academic term status.' using errcode = '22023';
  end if;
  if new_status = 'active' then
    update public.academic_terms set status = 'closed', closed_at = coalesce(closed_at, now()) where status = 'active' and id <> target_term_id;
    update public.classes set archived_at = coalesce(archived_at, now())
      where academic_term_id in (select id from public.academic_terms where status = 'closed');
  end if;
  update public.academic_terms
  set status = new_status, closed_at = case when new_status = 'closed' then coalesce(closed_at, now()) else null end
  where id = target_term_id returning * into updated_term;
  if updated_term.id is null then raise exception 'Academic term not found.'; end if;
  if new_status = 'closed' then
    update public.classes set archived_at = coalesce(archived_at, now()) where academic_term_id = target_term_id;
  elsif new_status = 'active' then
    update public.classes set archived_at = null where academic_term_id = target_term_id;
  end if;
  return updated_term;
end;
$$;

drop function if exists public.admin_create_class_offering(uuid, uuid, text, text);

create or replace function public.faculty_create_class_offering(
  offering_subject_name text,
  offering_section text
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_term public.academic_terms;
  normalized_subject text := trim(offering_subject_name);
  normalized_section text := trim(offering_section);
  generated_code text;
  created_class public.classes;
begin
  if (select private.current_user_role()) is distinct from 'faculty' then
    raise exception 'Only faculty can create class offerings.' using errcode = '42501';
  end if;
  select * into selected_term from public.academic_terms where status = 'active' order by start_date desc limit 1;
  if selected_term.id is null then
    raise exception 'The administrator must activate an academic term before faculty can create a class.' using errcode = '22023';
  end if;
  if char_length(normalized_subject) < 2 or char_length(normalized_subject) > 100
    or char_length(normalized_section) < 1 or char_length(normalized_section) > 40 then
    raise exception 'Enter a valid subject and section.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.classes
    where faculty_id = auth.uid()
      and academic_term_id = selected_term.id
      and lower(subject_name) = lower(normalized_subject)
      and lower(section) = lower(normalized_section)
  ) then
    raise exception 'You already created this subject and section for the active term.' using errcode = '23505';
  end if;
  loop
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.classes (faculty_id, name, subject_name, section, code, term, end_date, academic_term_id, archived_at)
      values (
        auth.uid(),
        normalized_subject || ' - ' || normalized_section,
        normalized_subject,
        normalized_section,
        generated_code,
        substring(selected_term.academic_year from 1 for 4) || '-' || case when selected_term.semester = '2nd Semester' then '2' else '1' end,
        selected_term.end_date,
        selected_term.id,
        null
      ) returning * into created_class;
      return created_class;
    exception when unique_violation then
      -- Generate another enrollment code after the extremely unlikely collision.
    end;
  end loop;
end;
$$;

revoke all on function public.admin_create_academic_term(text, text, date, date, boolean) from public, anon;
revoke all on function public.admin_set_academic_term_status(uuid, text) from public, anon;
revoke all on function public.faculty_create_class_offering(text, text) from public, anon;
revoke all on function public.refresh_expired_academic_terms() from public, anon;
grant execute on function public.admin_create_academic_term(text, text, date, date, boolean) to authenticated;
grant execute on function public.admin_set_academic_term_status(uuid, text) to authenticated;
grant execute on function public.faculty_create_class_offering(text, text) to authenticated;
grant execute on function public.refresh_expired_academic_terms() to authenticated;

create or replace function public.admin_update_academic_term(
  target_term_id uuid,
  term_academic_year text,
  term_semester text,
  term_start_date date,
  term_end_date date
)
returns public.academic_terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_year text := trim(term_academic_year);
  normalized_semester text := trim(term_semester);
  current_term public.academic_terms;
  updated_term public.academic_terms;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only administrators can manage academic terms.' using errcode = '42501';
  end if;
  select * into current_term from public.academic_terms where id = target_term_id for update;
  if current_term.id is null then raise exception 'Academic term not found.' using errcode = 'P0002'; end if;
  if normalized_year !~ '^\d{4}-\d{4}$'
    or substring(normalized_year from 6 for 4)::integer <> substring(normalized_year from 1 for 4)::integer + 1 then
    raise exception 'Academic year must contain consecutive years, such as 2026-2027.' using errcode = '22023';
  end if;
  if normalized_semester not in ('1st Semester', '2nd Semester') then
    raise exception 'Select either 1st Semester or 2nd Semester.' using errcode = '22023';
  end if;
  if term_start_date is null or term_end_date is null or term_end_date < term_start_date then
    raise exception 'Enter a valid term date range.' using errcode = '22023';
  end if;
  if current_term.status = 'active' and term_end_date < current_date then
    raise exception 'An active term cannot end in the past. Close the term first or enter a current end date.' using errcode = '22023';
  end if;
  update public.academic_terms
  set academic_year = normalized_year, semester = normalized_semester,
      start_date = term_start_date, end_date = term_end_date
  where id = target_term_id returning * into updated_term;
  update public.classes
  set term = substring(normalized_year from 1 for 4) || '-' || case when normalized_semester = '2nd Semester' then '2' else '1' end,
      end_date = term_end_date
  where academic_term_id = target_term_id;
  return updated_term;
end;
$$;

revoke all on function public.admin_update_academic_term(uuid, text, text, date, date) from public, anon;
grant execute on function public.admin_update_academic_term(uuid, text, text, date, date) to authenticated;

create or replace function private.prevent_closed_term_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_class_id uuid;
  term_is_closed boolean;
begin
  if tg_table_name = 'classes' then
    affected_class_id := old.id;
  else
    affected_class_id := old.class_id;
  end if;

  select exists (
    select 1
    from public.classes c
    join public.academic_terms t on t.id = c.academic_term_id
    where c.id = affected_class_id and t.status = 'closed'
  ) into term_is_closed;

  if term_is_closed and (select private.current_user_role()) in ('faculty', 'student') then
    raise exception 'This class belongs to a closed academic term and is read-only.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_closed_term_classes on public.classes;
create trigger protect_closed_term_classes before update or delete on public.classes
for each row execute function private.prevent_closed_term_changes();

drop trigger if exists protect_closed_term_enrollments on public.enrollments;
create trigger protect_closed_term_enrollments before update or delete on public.enrollments
for each row execute function private.prevent_closed_term_changes();

drop trigger if exists protect_closed_term_releases on public.assessment_releases;
create trigger protect_closed_term_releases before update or delete on public.assessment_releases
for each row execute function private.prevent_closed_term_changes();

drop trigger if exists protect_closed_term_attempts on public.assessment_attempts;
create trigger protect_closed_term_attempts before update or delete on public.assessment_attempts
for each row execute function private.prevent_closed_term_changes();

commit;
notify pgrst, 'reload schema';
