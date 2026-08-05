-- Assign a random 50% of a firearm's question bank to each attempt.
-- Odd totals round up so every non-empty bank produces at least one question.

create or replace function private.assign_random_assessment_questions(
  target_attempt_id uuid,
  target_firearm_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_count integer;
begin
  with randomized_questions as (
    select
      question.id,
      (row_number() over (order by random()))::integer as question_position,
      count(*) over ()::integer as total_count
    from public.assessment_questions as question
    where question.firearm_id = target_firearm_id
  )
  insert into public.assessment_attempt_questions (
    attempt_id,
    question_id,
    question_position
  )
  select
    target_attempt_id,
    randomized.id,
    randomized.question_position
  from randomized_questions as randomized
  where randomized.question_position <= greatest(
    1,
    ceil(randomized.total_count / 2.0)::integer
  );

  get diagnostics assigned_count = row_count;
  return assigned_count;
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
  assigned_count integer;
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

    assigned_count := private.assign_random_assessment_questions(
      current_attempt.id,
      target_firearm_id
    );

    if assigned_count = 0 then
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

create or replace function public.reset_student_assessment_attempt(
  target_attempt_id uuid
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_attempt public.assessment_attempts;
  reset_attempt public.assessment_attempts;
  assigned_count integer;
begin
  select * into target_attempt
  from public.assessment_attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null
    or not (select private.owns_class(target_attempt.class_id)) then
    raise exception 'Attempt not found or not owned by this Faculty account.'
      using errcode = '42501';
  end if;

  delete from public.assessment_responses
  where attempt_id = target_attempt.id;

  delete from public.assessment_attempt_questions
  where attempt_id = target_attempt.id;

  assigned_count := private.assign_random_assessment_questions(
    target_attempt.id,
    target_attempt.firearm_id
  );

  if assigned_count = 0 then
    raise exception 'This firearm has no assessment questions.'
      using errcode = 'P0002';
  end if;

  update public.assessment_attempts
  set status = 'in_progress',
      correct_count = null,
      total_questions = null,
      percentage = null,
      started_at = now(),
      submitted_at = null
  where id = target_attempt.id
  returning * into reset_attempt;

  return reset_attempt;
end;
$$;

revoke all on function private.assign_random_assessment_questions(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.start_assessment(uuid) from public, anon;
revoke all on function public.reset_student_assessment_attempt(uuid)
from public, anon;
grant execute on function public.start_assessment(uuid) to authenticated;
grant execute on function public.reset_student_assessment_attempt(uuid)
to authenticated;
