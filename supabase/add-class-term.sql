alter table public.classes
add column if not exists term text not null default 'Current term'
check (char_length(trim(term)) between 2 and 60);

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
