-- Restore full-bank assessments while retaining randomized question order.
-- This safely reverses migration 015 for new and Faculty-reset attempts.

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
  insert into public.assessment_attempt_questions (
    attempt_id,
    question_id,
    question_position
  )
  select
    target_attempt_id,
    question.id,
    (row_number() over (order by random()))::integer
  from public.assessment_questions as question
  where question.firearm_id = target_firearm_id;

  get diagnostics assigned_count = row_count;
  return assigned_count;
end;
$$;

revoke all on function private.assign_random_assessment_questions(uuid, uuid)
from public, anon, authenticated;
