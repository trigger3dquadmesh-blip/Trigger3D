-- Trigger3D firearm model import pipeline.
-- Requires the roles and enrollment migrations.

do $$
begin
  create type public.firearm_import_status as enum ('ready', 'archived');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.firearms (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique
    check (identifier ~ '^gun_[a-z0-9]+$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  caliber text not null check (char_length(trim(caliber)) between 1 and 40),
  description text not null default '',
  glb_storage_path text not null unique,
  status public.firearm_import_status not null default 'ready',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firearm_components (
  id uuid primary key default gen_random_uuid(),
  firearm_id uuid not null references public.firearms (id) on delete cascade,
  mesh_name text not null,
  category text not null check (category in ('external', 'internal')),
  purpose text not null,
  description text not null,
  display_order integer not null check (display_order > 0),
  constraint firearm_components_firearm_mesh_key
    unique (firearm_id, mesh_name),
  constraint firearm_components_firearm_order_key
    unique (firearm_id, display_order)
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  firearm_id uuid not null references public.firearms (id) on delete cascade,
  question_id text not null,
  question_type text not null
    check (question_type in ('text_identification', 'image_identification')),
  prompt text not null,
  component_name text not null,
  image_file text,
  accepted_answers text[] not null check (cardinality(accepted_answers) > 0),
  constraint assessment_questions_firearm_question_key
    unique (firearm_id, question_id),
  constraint assessment_questions_component_fkey
    foreign key (firearm_id, component_name)
    references public.firearm_components (firearm_id, mesh_name)
    on delete cascade
);

create index if not exists firearm_components_firearm_id_idx
on public.firearm_components (firearm_id);

create index if not exists assessment_questions_firearm_id_idx
on public.assessment_questions (firearm_id);

alter table public.firearms enable row level security;
alter table public.firearm_components enable row level security;
alter table public.assessment_questions enable row level security;

revoke all on table public.firearms from anon, authenticated;
revoke all on table public.firearm_components from anon, authenticated;
revoke all on table public.assessment_questions from anon, authenticated;
grant select on table public.firearms to authenticated;
grant select on table public.firearm_components to authenticated;
grant select on table public.assessment_questions to authenticated;

create or replace function private.has_any_active_enrollment()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments
    where student_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.can_view_firearm(target_firearm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.firearms as firearm
    where firearm.id = target_firearm_id
      and (
        (select private.current_user_role()) = 'admin'
        or (
          firearm.status = 'ready'
          and (select private.current_user_role()) = 'faculty'
        )
        or (
          firearm.status = 'ready'
          and (select private.current_user_role()) = 'student'
          and (select private.has_any_active_enrollment())
        )
      )
  );
$$;

revoke all on function private.has_any_active_enrollment() from public;
revoke all on function private.can_view_firearm(uuid) from public;
grant execute on function private.has_any_active_enrollment() to authenticated;
grant execute on function private.can_view_firearm(uuid) to authenticated;

drop policy if exists "Authorized users can view firearms" on public.firearms;
create policy "Authorized users can view firearms"
on public.firearms
for select
to authenticated
using ((select private.can_view_firearm(id)));

drop policy if exists "Authorized users can view firearm components"
on public.firearm_components;
create policy "Authorized users can view firearm components"
on public.firearm_components
for select
to authenticated
using ((select private.can_view_firearm(firearm_id)));

drop policy if exists "Authorized users can view assessment questions"
on public.assessment_questions;
create policy "Authorized users can view assessment questions"
on public.assessment_questions
for select
to authenticated
using ((select private.can_view_firearm(firearm_id)));

drop trigger if exists firearms_set_updated_at on public.firearms;
create trigger firearms_set_updated_at
before update on public.firearms
for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'firearm-models',
  'firearm-models',
  false,
  array['model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload firearm models" on storage.objects;
create policy "Admins can upload firearm models"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'firearm-models'
  and (select private.current_user_role()) = 'admin'
);

drop policy if exists "Admins can view firearm model objects" on storage.objects;
create policy "Admins can view firearm model objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'firearm-models'
  and (select private.current_user_role()) = 'admin'
);

drop policy if exists "Admins can delete firearm model objects" on storage.objects;
create policy "Admins can delete firearm model objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'firearm-models'
  and (select private.current_user_role()) = 'admin'
);

create or replace function public.finalize_firearm_import(
  model_identifier text,
  model_name text,
  model_caliber text,
  model_description text,
  model_storage_path text,
  imported_components jsonb,
  imported_questions jsonb
)
returns public.firearms
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identifier text := lower(trim(model_identifier));
  created_firearm public.firearms;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only Admin accounts can import firearm models.'
      using errcode = '42501';
  end if;

  if normalized_identifier !~ '^gun_[a-z0-9]+$' then
    raise exception 'The model identifier must use the gun_a naming format.'
      using errcode = '22023';
  end if;

  if trim(model_name) = '' or trim(model_caliber) = '' then
    raise exception 'Model name and caliber are required.'
      using errcode = '22023';
  end if;

  if model_storage_path !~ ('^' || normalized_identifier || '/.+[.]glb$') then
    raise exception 'The uploaded GLB path does not match the model identifier.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(imported_components) is distinct from 'array'
    or jsonb_array_length(imported_components) = 0 then
    raise exception 'At least one component is required.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(imported_questions) is distinct from 'array'
    or jsonb_array_length(imported_questions) = 0 then
    raise exception 'At least one assessment question is required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(imported_components) as component
    where nullif(trim(component ->> 'component_name'), '') is null
      or component ->> 'category' not in ('external', 'internal')
      or nullif(trim(component ->> 'purpose'), '') is null
      or nullif(trim(component ->> 'description'), '') is null
      or coalesce(component ->> 'display_order', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'One or more component records are invalid.'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(imported_components)
  ) is distinct from (
    select count(distinct component ->> 'component_name')
    from jsonb_array_elements(imported_components) as component
  ) then
    raise exception 'Component names must be unique.'
      using errcode = '23505';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(imported_components)
  ) is distinct from (
    select count(distinct component ->> 'display_order')
    from jsonb_array_elements(imported_components) as component
  ) then
    raise exception 'Component display orders must be unique.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(imported_questions) as question
    where nullif(trim(question ->> 'question_id'), '') is null
      or question ->> 'question_type'
        not in ('text_identification', 'image_identification')
      or nullif(trim(question ->> 'prompt'), '') is null
      or nullif(trim(question ->> 'component_name'), '') is null
      or jsonb_typeof(question -> 'accepted_answers') is distinct from 'array'
      or jsonb_array_length(question -> 'accepted_answers') = 0
      or (
        question ->> 'question_type' = 'image_identification'
        and nullif(trim(question ->> 'image_file'), '') is null
      )
  ) then
    raise exception 'One or more assessment questions are invalid.'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(imported_questions)
  ) is distinct from (
    select count(distinct question ->> 'question_id')
    from jsonb_array_elements(imported_questions) as question
  ) then
    raise exception 'Question IDs must be unique.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(imported_questions) as question
    where not exists (
      select 1
      from jsonb_array_elements(imported_components) as component
      where component ->> 'component_name' = question ->> 'component_name'
    )
  ) then
    raise exception 'Every question must reference an imported component.'
      using errcode = '23503';
  end if;

  insert into public.firearms (
    identifier,
    name,
    caliber,
    description,
    glb_storage_path,
    status,
    created_by
  )
  values (
    normalized_identifier,
    trim(model_name),
    trim(model_caliber),
    trim(coalesce(model_description, '')),
    model_storage_path,
    'ready',
    (select auth.uid())
  )
  returning * into created_firearm;

  insert into public.firearm_components (
    firearm_id,
    mesh_name,
    category,
    purpose,
    description,
    display_order
  )
  select
    created_firearm.id,
    component ->> 'component_name',
    component ->> 'category',
    component ->> 'purpose',
    component ->> 'description',
    (component ->> 'display_order')::integer
  from jsonb_array_elements(imported_components) as component;

  insert into public.assessment_questions (
    firearm_id,
    question_id,
    question_type,
    prompt,
    component_name,
    image_file,
    accepted_answers
  )
  select
    created_firearm.id,
    question ->> 'question_id',
    question ->> 'question_type',
    question ->> 'prompt',
    question ->> 'component_name',
    nullif(trim(question ->> 'image_file'), ''),
    array(
      select answer
      from jsonb_array_elements_text(question -> 'accepted_answers') as answer
      where trim(answer) <> ''
    )
  from jsonb_array_elements(imported_questions) as question;

  return created_firearm;
end;
$$;

revoke all on function public.finalize_firearm_import(
  text, text, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.finalize_firearm_import(
  text, text, text, text, text, jsonb, jsonb
) to authenticated;
