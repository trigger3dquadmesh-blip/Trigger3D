-- Allow the owning Faculty instructor to clear an attempt for a retake.

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

  if not exists (
    select 1
    from public.assessment_questions
    where firearm_id = target_attempt.firearm_id
  ) then
    raise exception 'This firearm has no assessment questions.'
      using errcode = 'P0002';
  end if;

  delete from public.assessment_responses
  where attempt_id = target_attempt.id;

  delete from public.assessment_attempt_questions
  where attempt_id = target_attempt.id;

  insert into public.assessment_attempt_questions (
    attempt_id,
    question_id,
    question_position
  )
  select
    target_attempt.id,
    question.id,
    (row_number() over (order by random()))::integer
  from public.assessment_questions as question
  where question.firearm_id = target_attempt.firearm_id;

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

revoke all on function public.reset_student_assessment_attempt(uuid)
from public, anon;
grant execute on function public.reset_student_assessment_attempt(uuid)
to authenticated;
