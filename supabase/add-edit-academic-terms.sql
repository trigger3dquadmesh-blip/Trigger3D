begin;

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
  if current_term.id is null then
    raise exception 'Academic term not found.' using errcode = 'P0002';
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
  if current_term.status = 'active' and term_end_date < current_date then
    raise exception 'An active term cannot end in the past. Close the term first or enter a current end date.' using errcode = '22023';
  end if;

  update public.academic_terms
  set academic_year = normalized_year,
      semester = normalized_semester,
      start_date = term_start_date,
      end_date = term_end_date
  where id = target_term_id
  returning * into updated_term;

  update public.classes
  set term = substring(normalized_year from 1 for 4) || '-' || case when normalized_semester = '2nd Semester' then '2' else '1' end,
      end_date = term_end_date
  where academic_term_id = target_term_id;

  return updated_term;
end;
$$;

revoke all on function public.admin_update_academic_term(uuid, text, text, date, date) from public, anon;
grant execute on function public.admin_update_academic_term(uuid, text, text, date, date) to authenticated;

commit;
notify pgrst, 'reload schema';
