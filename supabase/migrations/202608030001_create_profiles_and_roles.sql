-- Trigger3D account roles and profile security.
-- Run this in the Supabase SQL Editor or with the Supabase CLI.

create schema if not exists private;
revoke all on schema private from public;

do $$
begin
  create type public.app_role as enum ('admin', 'faculty', 'student');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

revoke all on function private.current_user_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Admins can view every profile" on public.profiles;
create policy "Admins can view every profile"
on public.profiles
for select
to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only administrators can assign account roles.'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role)
from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.app_role)
to authenticated;

-- Create profiles for Auth users that existed before this migration.
insert into public.profiles (id, email, full_name, role)
select
  users.id,
  coalesce(users.email, ''),
  nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
  'student'
from auth.users as users
on conflict (id) do nothing;
