-- Expose the attempt start/restart timestamp so browser drafts can reject stale answers.

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
    'attempt_started_at', existing_attempt.started_at,
    'percentage', existing_attempt.percentage,
    'correct_count', existing_attempt.correct_count,
    'total_questions', existing_attempt.total_questions
  );
end;
$$;

revoke all on function public.get_assessment_status(uuid)
from public, anon;
grant execute on function public.get_assessment_status(uuid)
to authenticated;
