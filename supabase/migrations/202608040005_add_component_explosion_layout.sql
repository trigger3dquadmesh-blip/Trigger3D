-- Add CSV-driven exploded-view metadata and support updating existing firearms.

alter table public.firearm_components
  add column if not exists explode_x double precision not null default 0,
  add column if not exists explode_y double precision not null default 0,
  add column if not exists explode_z double precision not null default 0,
  add column if not exists explode_order integer not null default 0
    check (explode_order >= 0),
  add column if not exists assembly_group text not null default 'ungrouped'
    check (assembly_group ~ '^[a-z0-9_]+$');

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
      or coalesce(component ->> 'explode_x', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_y', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_z', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_order', '') !~ '^(0|[1-9][0-9]*)$'
      or coalesce(component ->> 'assembly_group', '') !~ '^[a-z0-9_]+$'
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
    display_order,
    explode_x,
    explode_y,
    explode_z,
    explode_order,
    assembly_group
  )
  select
    created_firearm.id,
    component ->> 'component_name',
    component ->> 'category',
    component ->> 'purpose',
    component ->> 'description',
    (component ->> 'display_order')::integer,
    (component ->> 'explode_x')::double precision,
    (component ->> 'explode_y')::double precision,
    (component ->> 'explode_z')::double precision,
    (component ->> 'explode_order')::integer,
    component ->> 'assembly_group'
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

create or replace function public.update_firearm_component_layout(
  model_identifier text,
  imported_components jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_identifier text := lower(trim(model_identifier));
  target_firearm_id uuid;
  updated_count integer;
begin
  if (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'Only Admin accounts can update component layouts.'
      using errcode = '42501';
  end if;

  select id into target_firearm_id
  from public.firearms
  where identifier = normalized_identifier;

  if target_firearm_id is null then
    raise exception 'The selected firearm does not exist.'
      using errcode = 'P0002';
  end if;

  if jsonb_typeof(imported_components) is distinct from 'array'
    or jsonb_array_length(imported_components) = 0 then
    raise exception 'At least one component is required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(imported_components) as component
    where nullif(trim(component ->> 'component_name'), '') is null
      or coalesce(component ->> 'explode_x', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_y', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_z', '') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or coalesce(component ->> 'explode_order', '') !~ '^(0|[1-9][0-9]*)$'
      or coalesce(component ->> 'assembly_group', '') !~ '^[a-z0-9_]+$'
  ) then
    raise exception 'One or more component layout records are invalid.'
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
    select count(*)
    from public.firearm_components
    where firearm_id = target_firearm_id
  ) or exists (
    select 1
    from jsonb_array_elements(imported_components) as component
    where not exists (
      select 1
      from public.firearm_components as stored
      where stored.firearm_id = target_firearm_id
        and stored.mesh_name = component ->> 'component_name'
    )
  ) then
    raise exception 'The CSV component names must exactly match the imported firearm.'
      using errcode = '22023';
  end if;

  with layout as (
    select
      component ->> 'component_name' as mesh_name,
      (component ->> 'explode_x')::double precision as explode_x,
      (component ->> 'explode_y')::double precision as explode_y,
      (component ->> 'explode_z')::double precision as explode_z,
      (component ->> 'explode_order')::integer as explode_order,
      component ->> 'assembly_group' as assembly_group
    from jsonb_array_elements(imported_components) as component
  )
  update public.firearm_components as stored
  set explode_x = layout.explode_x,
      explode_y = layout.explode_y,
      explode_z = layout.explode_z,
      explode_order = layout.explode_order,
      assembly_group = layout.assembly_group
  from layout
  where stored.firearm_id = target_firearm_id
    and stored.mesh_name = layout.mesh_name;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.update_firearm_component_layout(text, jsonb)
from public, anon;
grant execute on function public.update_firearm_component_layout(text, jsonb)
to authenticated;
