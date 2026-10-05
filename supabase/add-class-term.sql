alter table public.classes
add column if not exists term text not null default 'Current term'
check (char_length(trim(term)) between 2 and 60);

alter table public.classes
add column if not exists end_date date;

create or replace function public.create_class(class_name text, class_term text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := trim(class_name);
  normalized_term text := trim(class_term);
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

  if char_length(normalized_term) < 2 or char_length(normalized_term) > 60 then
    raise exception 'Semester or term must contain between 2 and 60 characters.'
      using errcode = '22023';
  end if;

  loop
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.classes (faculty_id, name, code, term)
      values ((select auth.uid()), normalized_name, generated_code, normalized_term)
      returning * into created_class;

      return created_class;
    exception
      when unique_violation then
        -- Generate another code if an extremely unlikely collision occurs.
    end;
  end loop;
end;
$$;

revoke all on function public.create_class(text, text) from public, anon;
grant execute on function public.create_class(text, text) to authenticated;

create or replace function public.update_class_details(target_class_id uuid, class_name text, class_term text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := trim(class_name);
  normalized_term text := trim(class_term);
  updated_class public.classes;
begin
  if (select private.current_user_role()) is distinct from 'faculty' then
    raise exception 'Only Faculty accounts can update class details.' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 100 then
    raise exception 'Class names must contain between 2 and 100 characters.' using errcode = '22023';
  end if;

  if char_length(normalized_term) < 2 or char_length(normalized_term) > 60 then
    raise exception 'Semester or term must contain between 2 and 60 characters.' using errcode = '22023';
  end if;

  update public.classes
  set name = normalized_name, term = normalized_term
  where id = target_class_id
    and faculty_id = (select auth.uid())
    and archived_at is null
  returning * into updated_class;

  if updated_class.id is null then
    raise exception 'Class not found, already read-only, or you do not have permission to update it.' using errcode = '42501';
  end if;

  return updated_class;
end;
$$;

revoke all on function public.update_class_details(uuid, text, text) from public, anon;
grant execute on function public.update_class_details(uuid, text, text) to authenticated;

create or replace function public.create_class(
  class_name text,
  class_semester text,
  class_academic_year text,
  class_end_date date
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := trim(class_name);
  normalized_semester text := trim(class_semester);
  normalized_academic_year text := trim(class_academic_year);
  normalized_term text;
  start_year integer;
  end_year integer;
  generated_code text;
  created_class public.classes;
begin
  if (select private.current_user_role()) is distinct from 'faculty' then
    raise exception 'Only Faculty accounts can create classes.' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 100 then
    raise exception 'Class names must contain between 2 and 100 characters.' using errcode = '22023';
  end if;

  if normalized_semester not in ('1st Semester', '2nd Semester') then
    raise exception 'Select either 1st Semester or 2nd Semester.' using errcode = '22023';
  end if;

  if normalized_academic_year !~ '^\d{4}-\d{4}$' then
    raise exception 'Academic year must use the format 2026-2027.' using errcode = '22023';
  end if;
  start_year := substring(normalized_academic_year from 1 for 4)::integer;
  end_year := substring(normalized_academic_year from 6 for 4)::integer;
  if end_year <> start_year + 1 then
    raise exception 'The academic year must contain consecutive years.' using errcode = '22023';
  end if;

  if class_end_date is null then
    raise exception 'Select the semester end date.' using errcode = '22023';
  end if;

  normalized_term := start_year::text || '-' || case when normalized_semester = '2nd Semester' then '2' else '1' end;
  loop
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.classes (faculty_id, name, code, term, end_date, archived_at)
      values (
        (select auth.uid()),
        normalized_name,
        generated_code,
        normalized_term,
        class_end_date,
        case when class_end_date < current_date then now() else null end
      )
      returning * into created_class;
      return created_class;
    exception when unique_violation then
      -- Generate another enrollment code after the extremely unlikely collision.
    end;
  end loop;
end;
$$;

revoke all on function public.create_class(text, text, text, date) from public, anon;
grant execute on function public.create_class(text, text, text, date) to authenticated;

create or replace function public.archive_expired_classes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  if (select private.current_user_role()) is distinct from 'faculty' then
    return 0;
  end if;

  update public.classes
  set archived_at = now()
  where faculty_id = (select auth.uid())
    and archived_at is null
    and end_date is not null
    and end_date < current_date;
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_expired_classes() from public, anon;
grant execute on function public.archive_expired_classes() to authenticated;
