-- Protected Faculty result detail without exposing accepted answers.

create or replace function public.get_class_assessment_results(target_class_id uuid)
returns table (
  attempt_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  firearm_id uuid,
  firearm_name text,
  firearm_caliber text,
  correct_count integer,
  total_questions integer,
  percentage numeric,
  submitted_at timestamptz,
  question_id text,
  prompt text,
  component_name text,
  student_answer text,
  is_correct boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.owns_class(target_class_id))
    and (select private.current_user_role()) is distinct from 'admin' then
    raise exception 'The selected class is not available to this account.'
      using errcode = '42501';
  end if;

  return query
  select
    attempt.id,
    attempt.student_id,
    coalesce(nullif(trim(profile.full_name), ''), profile.email),
    profile.email,
    attempt.firearm_id,
    firearm.name,
    firearm.caliber,
    attempt.correct_count,
    attempt.total_questions,
    attempt.percentage,
    attempt.submitted_at,
    question.question_id,
    question.prompt,
    question.component_name,
    response.answer,
    response.is_correct
  from public.assessment_attempts as attempt
  join public.profiles as profile on profile.id = attempt.student_id
  join public.firearms as firearm on firearm.id = attempt.firearm_id
  join public.assessment_attempt_questions as assigned
    on assigned.attempt_id = attempt.id
  join public.assessment_questions as question
    on question.id = assigned.question_id
  join public.assessment_responses as response
    on response.attempt_id = attempt.id
    and response.question_id = question.id
  where attempt.class_id = target_class_id
    and attempt.status = 'submitted'
  order by attempt.submitted_at desc, assigned.question_position;
end;
$$;

revoke all on function public.get_class_assessment_results(uuid)
from public, anon;
grant execute on function public.get_class_assessment_results(uuid)
to authenticated;
