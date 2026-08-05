-- Enforce the school email domain at the database boundary.
-- Browser validation remains useful feedback, but this trigger is authoritative.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  at_sign_count integer;
begin
  at_sign_count := char_length(normalized_email)
    - char_length(replace(normalized_email, '@', ''));

  if at_sign_count <> 1
    or split_part(normalized_email, '@', 1) = ''
    or split_part(normalized_email, '@', 2) <> 'parsu.edu.ph' then
    raise exception 'Student registration requires an @parsu.edu.ph email address.'
      using errcode = '22023';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    normalized_email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
from public, anon, authenticated;
