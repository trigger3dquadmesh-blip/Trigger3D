begin;

alter table public.assessment_releases
  add column if not exists duration_minutes integer not null default 60;

alter table public.assessment_attempts
  add column if not exists timer_started_at timestamptz;

alter table public.assessment_attempts
  add column if not exists integrity_locked_at timestamptz,
  add column if not exists integrity_lock_reason text;

alter table public.assessment_releases
  drop constraint if exists assessment_releases_duration_minutes_check;

alter table public.assessment_releases
  add constraint assessment_releases_duration_minutes_check
  check (duration_minutes between 1 and 480);

create or replace function public.set_assessment_release_with_duration(
  target_class_id uuid,
  target_firearm_id uuid,
  open_state boolean,
  assessment_duration_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if assessment_duration_minutes is null
    or assessment_duration_minutes < 1
    or assessment_duration_minutes > 480 then
    raise exception 'Assessment duration must be between 1 and 480 minutes.';
  end if;

  perform public.set_assessment_release(
    target_class_id,
    target_firearm_id,
    open_state
  );

  update public.assessment_releases
  set duration_minutes = assessment_duration_minutes
  where class_id = target_class_id
    and firearm_id = target_firearm_id;
end;
$$;

revoke all on function public.set_assessment_release_with_duration(uuid, uuid, boolean, integer) from public;
grant execute on function public.set_assessment_release_with_duration(uuid, uuid, boolean, integer) to authenticated;

create or replace function public.begin_assessment_timer(target_attempt_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  timer_start timestamptz;
begin
  update public.assessment_attempts
  set timer_started_at = coalesce(timer_started_at, now())
  where id = target_attempt_id
    and student_id = auth.uid()
    and status = 'in_progress'
    and integrity_locked_at is null
  returning timer_started_at into timer_start;

  if timer_start is null then
    raise exception 'This assessment attempt is not available.';
  end if;

  return timer_start;
end;
$$;

revoke all on function public.begin_assessment_timer(uuid) from public;
grant execute on function public.begin_assessment_timer(uuid) to authenticated;

create or replace function public.get_my_assessment_integrity_status(target_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_locked', integrity_locked_at is not null,
    'locked_at', integrity_locked_at,
    'reason', integrity_lock_reason
  )
  from public.assessment_attempts
  where id = target_attempt_id
    and student_id = auth.uid();
$$;

revoke all on function public.get_my_assessment_integrity_status(uuid) from public;
grant execute on function public.get_my_assessment_integrity_status(uuid) to authenticated;

create or replace function public.lock_assessment_for_integrity(
  target_attempt_id uuid,
  violation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if violation_reason not in ('fullscreen_exited', 'page_hidden', 'window_blurred', 'assessment_page_left') then
    raise exception 'Invalid assessment integrity reason.';
  end if;

  update public.assessment_attempts
  set integrity_locked_at = coalesce(integrity_locked_at, now()),
      integrity_lock_reason = coalesce(integrity_lock_reason, violation_reason)
  where id = target_attempt_id
    and student_id = auth.uid()
    and status = 'in_progress';

  if not found then
    raise exception 'This assessment attempt is not available.';
  end if;
end;
$$;

revoke all on function public.lock_assessment_for_integrity(uuid, text) from public;
grant execute on function public.lock_assessment_for_integrity(uuid, text) to authenticated;

create or replace function public.reset_student_assessment_attempt_with_timer(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reset_student_assessment_attempt(target_attempt_id);

  update public.assessment_attempts
  set timer_started_at = null,
      integrity_locked_at = null,
      integrity_lock_reason = null
  where id = target_attempt_id;
end;
$$;

revoke all on function public.reset_student_assessment_attempt_with_timer(uuid) from public;
grant execute on function public.reset_student_assessment_attempt_with_timer(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
