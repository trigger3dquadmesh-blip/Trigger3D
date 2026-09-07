create or replace function public.get_my_assessment_review(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_class_id uuid;
  attempt_student_id uuid;
  attempt_status text;
  review jsonb;
begin
  select class_id, student_id, status::text
  into attempt_class_id, attempt_student_id, attempt_status
  from public.assessment_attempts
  where id = target_attempt_id;

  if attempt_student_id is null or attempt_student_id <> auth.uid() then
    raise exception 'You can only review your own assessment.';
  end if;

  if attempt_status <> 'submitted' then
    raise exception 'Answer review is available only after submission.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attempt_id', target_attempt_id,
        'question_id', coalesce(question_data ->> 'question_id', question_data ->> 'id', response_data ->> 'question_id'),
        'prompt', coalesce(question_data ->> 'prompt', 'Component identification question'),
        'component_name', coalesce(question_data ->> 'component_name', question_data ->> 'correct_answer', ''),
        'student_answer', coalesce(response_data ->> 'submitted_answer', response_data ->> 'student_answer', response_data ->> 'answer', '[No answer — time expired]'),
        'is_correct', coalesce((response_data ->> 'is_correct')::boolean, false)
      )
      order by coalesce(question_data ->> 'question_id', question_data ->> 'id', response_data ->> 'question_id')
    ),
    '[]'::jsonb
  )
  into review
  from (
    select to_jsonb(response_row) as response_data
    from public.assessment_responses as response_row
    where response_row.attempt_id = target_attempt_id
  ) as responses
  left join lateral (
    select to_jsonb(question_row) as question_data
    from public.assessment_questions as question_row
    where question_row.id::text = coalesce(
      response_data ->> 'assessment_question_id',
      response_data ->> 'question_id'
    )
    limit 1
  ) as questions on true;

  return review;
end;
$$;

revoke all on function public.get_my_assessment_review(uuid) from public;
grant execute on function public.get_my_assessment_review(uuid) to authenticated;
