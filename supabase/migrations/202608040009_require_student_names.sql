-- Require normalized Student display names while allowing existing accounts to complete setup.

update public.profiles
set full_name = null
where role = 'student'
  and full_name is not null
  and lower(trim(full_name)) = lower(trim(email));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_full_name_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_length_check
      check (
        full_name is null
        or char_length(trim(full_name)) between 2 and 100
      );
  end if;
end
$$;

create or replace function public.set_own_full_name(new_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := regexp_replace(
    trim(coalesce(new_full_name, '')),
    '\s+',
    ' ',
    'g'
  );
  updated_profile public.profiles;
begin
  if char_length(normalized_name) < 2
    or char_length(normalized_name) > 100 then
    raise exception 'Full name must contain between 2 and 100 characters.'
      using errcode = '22023';
  end if;

  update public.profiles
  set full_name = normalized_name
  where id = (select auth.uid())
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke update (full_name) on table public.profiles from authenticated;
revoke all on function public.set_own_full_name(text) from public, anon;
grant execute on function public.set_own_full_name(text) to authenticated;
