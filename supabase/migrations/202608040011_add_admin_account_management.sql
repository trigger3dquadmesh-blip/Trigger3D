-- Admin account metadata, disabling, and protected profile updates.

alter table public.profiles
  add column if not exists disabled_at timestamptz;

-- Keep imported learning content if the Admin who originally uploaded it is removed.
alter table public.firearms
  alter column created_by drop not null,
  drop constraint if exists firearms_created_by_fkey;

alter table public.firearms
  add constraint firearms_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and disabled_at is null;
$$;

create or replace function public.admin_update_account(
  target_user_id uuid,
  new_full_name text,
  new_role public.app_role,
  new_disabled boolean
)
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
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only administrators can manage accounts.'
      using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2
    or char_length(normalized_name) > 100 then
    raise exception 'Full name must contain between 2 and 100 characters.'
      using errcode = '22023';
  end if;

  if target_user_id = (select auth.uid())
    and (new_role is distinct from 'admin' or new_disabled) then
    raise exception 'You cannot demote or disable your own active Admin account.'
      using errcode = '42501';
  end if;

  update public.profiles
  set full_name = normalized_name,
      role = new_role,
      disabled_at = case
        when new_disabled then coalesce(disabled_at, now())
        else null
      end
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_account(
  uuid, text, public.app_role, boolean
) from public, anon;
grant execute on function public.admin_update_account(
  uuid, text, public.app_role, boolean
) to authenticated;
