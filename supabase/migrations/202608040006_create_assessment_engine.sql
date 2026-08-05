-- Trigger3D released, randomized, single-attempt assessment engine.

do $$
begin
  create type public.assessment_attempt_status as enum ('in_progress', 'submitted');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.assessment_releases (
  class_id uuid not null references public.classes (id) on delete cascade,
  firearm_id uuid not null references public.firearms (id) on delete cascade,
  is_open boolean not null default false,
  released_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (class_id, firearm_id)
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  firearm_id uuid not null references public.firearms (id) on delete cascade,
  status public.assessment_attempt_status not null default 'in_progress',
  correct_count integer,
  total_questions integer,
  percentage numeric(5, 2),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint assessment_attempts_one_per_student_firearm
    unique (student_id, firearm_id),
  constraint assessment_attempts_score_consistency check (
    (status = 'in_progress'
      and correct_count is null
      and total_questions is null
      and percentage is null
      and submitted_at is null)
    or
    (status = 'submitted'
      and correct_count >= 0
      and total_questions > 0
      and correct_count <= total_questions
      and percentage between 0 and 100
      and submitted_at is not null)
  )
);

create table if not exists public.assessment_attempt_questions (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  question_position integer not null check (question_position > 0),
  primary key (attempt_id, question_id),
  unique (attempt_id, question_position)
);

-- Keep this migration rerunnable if an earlier execution created the table
-- before failing at the function return definition.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_attempt_questions'
      and column_name = 'position'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_attempt_questions'
      and column_name = 'question_position'
  ) then
    alter table public.assessment_attempt_questions
      rename column "position" to question_position;
  end if;
end
$$;

create table if not exists public.assessment_responses (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  answer text not null check (char_length(trim(answer)) > 0),
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

create index if not exists assessment_releases_firearm_id_idx
on public.assessment_releases (firearm_id);
create index if not exists assessment_attempts_class_id_idx
on public.assessment_attempts (class_id);
create index if not exists assessment_attempts_firearm_id_idx
on public.assessment_attempts (firearm_id);

alter table public.assessment_releases enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_questions enable row level security;
alter table public.assessment_responses enable row level security;

revoke all on table public.assessment_releases from anon, authenticated;
revoke all on table public.assessment_attempts from anon, authenticated;
revoke all on table public.assessment_attempt_questions from anon, authenticated;
revoke all on table public.assessment_responses from anon, authenticated;
grant select on table public.assessment_releases to authenticated;
grant select on table public.assessment_attempts to authenticated;
grant select on table public.assessment_responses to authenticated;

-- Correct answers are available only inside security-definer scoring functions.
revoke select on table public.assessment_questions from authenticated;
drop policy if exists "Authorized users can view assessment questions"
on public.assessment_questions;

create or replace function private.can_view_assessment_attempt(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessment_attempts as attempt
    where attempt.id = target_attempt_id
      and (
        attempt.student_id = (select auth.uid())
        or (select private.owns_class(attempt.class_id))
        or (select private.current_user_role()) = 'admin'
      )
  );
$$;

revoke all on function private.can_view_assessment_attempt(uuid) from public;
grant execute on function private.can_view_assessment_attempt(uuid) to authenticated;

drop policy if exists "Authorized users can view assessment releases"
on public.assessment_releases;
create policy "Authorized users can view assessment releases"
on public.assessment_releases
for select
to authenticated
using (
  (select private.owns_class(class_id))
  or (select private.has_active_enrollment(class_id))
  or (select private.current_user_role()) = 'admin'
);

drop policy if exists "Authorized users can view assessment attempts"
on public.assessment_attempts;
create policy "Authorized users can view assessment attempts"
on public.assessment_attempts
for select
to authenticated
using (
  student_id = (select auth.uid())
  or (select private.owns_class(class_id))
  or (select private.current_user_role()) = 'admin'
);

drop policy if exists "Authorized users can view assessment responses"
on public.assessment_responses;
create policy "Authorized users can view assessment responses"
on public.assessment_responses
for select
to authenticated
using ((select private.can_view_assessment_attempt(attempt_id)));

create or replace function public.set_assessment_release(
  target_class_id uuid,
  target_firearm_id uuid,
  open_state boolean
)
returns public.assessment_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_release public.assessment_releases;
begin
  if not (select private.owns_class(target_class_id)) then
    raise exception 'The selected class is not owned by this Faculty account.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.firearms
    where id = target_firearm_id and status = 'ready'
  ) then
    raise exception 'The selected firearm is not available.'
      using errcode = 'P0002';
  end if;

  insert into public.assessment_releases (
    class_id, firearm_id, is_open, released_by, updated_at
  ) values (
    target_class_id, target_firearm_id, open_state, (select auth.uid()), now()
  )
  on conflict (class_id, firearm_id) do update
  set is_open = excluded.is_open,
      released_by = excluded.released_by,
      updated_at = excluded.updated_at
  returning * into saved_release;

  return saved_release;
end;
$$;

create or replace function public.get_assessment_status(target_firearm_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_class_id uuid;
  existing_attempt public.assessment_attempts;
  released boolean;
begin
  if (select private.current_user_role()) is distinct from 'student' then
    raise exception 'Only Student accounts can access assessments.'
      using errcode = '42501';
  end if;

  select class_id into active_class_id
  from public.enrollments
  where student_id = (select auth.uid()) and status = 'active';

  if active_class_id is null then
    raise exception 'An active class enrollment is required.' using errcode = '42501';
  end if;

  select coalesce(is_open, false) into released
  from public.assessment_releases
  where class_id = active_class_id and firearm_id = target_firearm_id;

  select * into existing_attempt
  from public.assessment_attempts
  where student_id = (select auth.uid()) and firearm_id = target_firearm_id;

  return jsonb_build_object(
    'is_released', coalesce(released, false),
    'attempt_id', existing_attempt.id,
    'attempt_status', existing_attempt.status,
    'percentage', existing_attempt.percentage,
    'correct_count', existing_attempt.correct_count,
    'total_questions', existing_attempt.total_questions
  );
end;
$$;

create or replace function public.start_assessment(target_firearm_id uuid)
returns table (
  attempt_id uuid,
  question_record_id uuid,
  question_id text,
  question_type text,
  prompt text,
  component_name text,
  image_file text,
  question_position integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_class_id uuid;
  current_attempt public.assessment_attempts;
begin
  if (select private.current_user_role()) is distinct from 'student' then
    raise exception 'Only Student accounts can start assessments.'
      using errcode = '42501';
  end if;

  select class_id into active_class_id
  from public.enrollments
  where student_id = (select auth.uid()) and status = 'active';

  if active_class_id is null then
    raise exception 'An active class enrollment is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.assessment_releases
    where class_id = active_class_id
      and firearm_id = target_firearm_id
      and is_open
  ) then
    raise exception 'Your Faculty instructor has not opened this assessment.'
      using errcode = '42501';
  end if;

  select * into current_attempt
  from public.assessment_attempts
  where student_id = (select auth.uid()) and firearm_id = target_firearm_id;

  if current_attempt.status = 'submitted' then
    raise exception 'This assessment has already been completed.'
      using errcode = '23505';
  end if;

  if current_attempt.id is null then
    insert into public.assessment_attempts (student_id, class_id, firearm_id)
    values ((select auth.uid()), active_class_id, target_firearm_id)
    returning * into current_attempt;

    insert into public.assessment_attempt_questions (
      attempt_id, question_id, question_position
    )
    select
      current_attempt.id,
      question.id,
      (row_number() over (order by random()))::integer
    from public.assessment_questions as question
    where question.firearm_id = target_firearm_id;

    if not found then
      raise exception 'This firearm has no assessment questions.'
        using errcode = 'P0002';
    end if;
  end if;

  return query
  select
    current_attempt.id,
    question.id,
    question.question_id,
    question.question_type,
    question.prompt,
    question.component_name,
    question.image_file,
    assigned.question_position
  from public.assessment_attempt_questions as assigned
  join public.assessment_questions as question on question.id = assigned.question_id
  where assigned.attempt_id = current_attempt.id
  order by assigned.question_position;
end;
$$;

create or replace function public.submit_assessment(
  target_attempt_id uuid,
  submitted_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_attempt public.assessment_attempts;
  expected_count integer;
  correct_answers integer;
  final_percentage numeric(5, 2);
begin
  select * into target_attempt
  from public.assessment_attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null or target_attempt.student_id <> (select auth.uid()) then
    raise exception 'Assessment attempt not found.' using errcode = '42501';
  end if;

  if target_attempt.status = 'submitted' then
    raise exception 'This assessment has already been submitted.'
      using errcode = '23505';
  end if;

  if not (select private.has_active_enrollment(target_attempt.class_id)) then
    raise exception 'An active class enrollment is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(submitted_answers) is distinct from 'array' then
    raise exception 'Submitted answers must be an array.' using errcode = '22023';
  end if;

  select count(*) into expected_count
  from public.assessment_attempt_questions
  where attempt_id = target_attempt_id;

  if jsonb_array_length(submitted_answers) <> expected_count
    or (
      select count(distinct answer ->> 'question_id')
      from jsonb_array_elements(submitted_answers) as answer
    ) <> expected_count
    or exists (
      select 1
      from jsonb_array_elements(submitted_answers) as answer
      where nullif(trim(answer ->> 'answer'), '') is null
        or not exists (
          select 1
          from public.assessment_attempt_questions as assigned
          where assigned.attempt_id = target_attempt_id
            and assigned.question_id = (answer ->> 'question_id')::uuid
        )
    )
  then
    raise exception 'Every assigned question must have exactly one answer.'
      using errcode = '22023';
  end if;

  insert into public.assessment_responses (attempt_id, question_id, answer, is_correct)
  select
    target_attempt_id,
    question.id,
    trim(submitted.answer),
    exists (
      select 1
      from unnest(question.accepted_answers) as accepted(answer)
      where lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(submitted.answer), '\s+', ' ', 'g'))
    )
  from jsonb_to_recordset(submitted_answers) as submitted(question_id uuid, answer text)
  join public.assessment_questions as question on question.id = submitted.question_id;

  select count(*) filter (where is_correct) into correct_answers
  from public.assessment_responses
  where attempt_id = target_attempt_id;

  final_percentage := round((correct_answers::numeric / expected_count) * 100, 2);

  update public.assessment_attempts
  set status = 'submitted',
      correct_count = correct_answers,
      total_questions = expected_count,
      percentage = final_percentage,
      submitted_at = now()
  where id = target_attempt_id;

  return jsonb_build_object(
    'attempt_id', target_attempt_id,
    'correct_count', correct_answers,
    'total_questions', expected_count,
    'percentage', final_percentage
  );
end;
$$;

revoke all on function public.set_assessment_release(uuid, uuid, boolean)
from public, anon;
revoke all on function public.get_assessment_status(uuid) from public, anon;
revoke all on function public.start_assessment(uuid) from public, anon;
revoke all on function public.submit_assessment(uuid, jsonb) from public, anon;
grant execute on function public.set_assessment_release(uuid, uuid, boolean)
to authenticated;
grant execute on function public.get_assessment_status(uuid) to authenticated;
grant execute on function public.start_assessment(uuid) to authenticated;
grant execute on function public.submit_assessment(uuid, jsonb) to authenticated;
