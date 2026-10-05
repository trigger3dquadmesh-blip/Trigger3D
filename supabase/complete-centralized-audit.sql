begin;

-- Adds meaningful-event coverage not handled by add-term-aware-audit-log.sql.
-- Reads, searches, timer ticks, answer autosaves, and model views stay excluded.
alter table public.audit_events add column if not exists academic_term_id uuid references public.academic_terms(id) on delete set null;
alter table public.audit_events add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.audit_events add column if not exists details jsonb not null default '{}'::jsonb;

create or replace function private.write_audit_event(
  audit_actor_id uuid, audit_event_type text, audit_entity_type text,
  audit_entity_id uuid, audit_record_label text, audit_reason text,
  audit_academic_term_id uuid default null, audit_class_id uuid default null,
  audit_details jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    actor_id, event_type, entity_type, entity_id, record_label, reason,
    academic_term_id, class_id, details
  ) values (
    audit_actor_id, audit_event_type, audit_entity_type, audit_entity_id,
    audit_record_label, audit_reason, audit_academic_term_id, audit_class_id,
    coalesce(audit_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.write_audit_event(uuid, text, text, uuid, text, text, uuid, uuid, jsonb) from public;

create or replace function private.record_academic_term_audit_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  action_name text;
  action_reason text;
begin
  action_name := case
    when tg_op = 'INSERT' then 'Academic term created'
    when new.status = 'closed' and old.status is distinct from new.status then 'Academic term closed'
    when new.status = 'active' and old.status is distinct from new.status then 'Academic term activated'
    else 'Academic term updated'
  end;
  action_reason := case action_name
    when 'Academic term created' then 'The administrator created a new academic term.'
    when 'Academic term closed' then 'The administrator closed this academic term and preserved its classes as historical records.'
    when 'Academic term activated' then 'The administrator made this the active academic term.'
    else 'The administrator corrected the academic-term information.'
  end;
  perform private.write_audit_event(
    auth.uid(), action_name, 'academic_terms', new.id,
    new.semester || ', AY ' || new.academic_year, action_reason, new.id, null,
    jsonb_build_object('operation', tg_op, 'status', new.status, 'academic_year', new.academic_year, 'semester', new.semester)
  );
  return new;
end;
$$;

drop trigger if exists audit_academic_terms on public.academic_terms;
create trigger audit_academic_terms after insert or update on public.academic_terms
for each row execute function private.record_academic_term_audit_event();

insert into public.audit_events (
  actor_id, event_type, entity_type, entity_id, record_label, reason,
  academic_term_id, class_id, details, created_at
)
select
  term.created_by, 'Academic term created', 'academic_terms', term.id,
  term.semester || ', AY ' || term.academic_year,
  'The administrator created a new academic term.', term.id, null,
  jsonb_build_object('operation', 'BACKFILL', 'status', term.status, 'academic_year', term.academic_year, 'semester', term.semester),
  term.created_at
from public.academic_terms term
where not exists (
  select 1 from public.audit_events event
  where event.entity_type in ('academic_terms', 'term')
    and event.entity_id = term.id
    and event.event_type = 'Academic term created'
);

create or replace function private.record_firearm_audit_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare action_name text;
begin
  action_name := case when tg_op = 'INSERT' then 'Firearm created' else 'Firearm updated' end;
  perform private.write_audit_event(
    auth.uid(), action_name, 'firearm', new.id, coalesce(new.name, new.identifier, 'Firearm'),
    case when tg_op = 'INSERT' then 'A firearm model was imported into the library.' else 'Firearm information or learning content was updated.' end,
    null, null, jsonb_build_object('operation', tg_op, 'identifier', new.identifier)
  );
  return new;
end;
$$;

drop trigger if exists audit_firearms_centralized on public.firearms;
create trigger audit_firearms_centralized after insert or update on public.firearms
for each row execute function private.record_firearm_audit_event();

create or replace function private.record_assessment_start_audit_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  related_term_id uuid;
  related_class_name text;
  related_firearm_name text;
begin
  select c.academic_term_id, c.name into related_term_id, related_class_name
  from public.classes c where c.id = new.class_id;
  select f.name into related_firearm_name from public.firearms f where f.id = new.firearm_id;
  perform private.write_audit_event(
    auth.uid(), 'Assessment started', 'assessment_attempts', new.id,
    coalesce(related_firearm_name, 'Assessment') || ' · ' || coalesce(related_class_name, 'Class'),
    'The student started this assessment attempt.', related_term_id, new.class_id,
    jsonb_build_object('operation', 'INSERT', 'student_id', new.student_id, 'firearm_id', new.firearm_id)
  );
  return new;
end;
$$;

drop trigger if exists audit_assessment_attempt_started on public.assessment_attempts;
create trigger audit_assessment_attempt_started after insert on public.assessment_attempts
for each row execute function private.record_assessment_start_audit_event();

-- Layout changes update many component rows, so record one readable event after
-- the complete operation succeeds instead of one event per component.
create or replace function public.record_firearm_layout_audit(target_firearm_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare firearm_label text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.disabled_at is null
  ) then raise exception 'Only active administrators can record firearm changes.';
  end if;
  select coalesce(f.name, f.identifier, 'Firearm') into firearm_label
  from public.firearms f where f.id = target_firearm_id;
  if firearm_label is null then raise exception 'Firearm not found.'; end if;
  perform private.write_audit_event(
    auth.uid(), 'Firearm layout updated', 'firearm', target_firearm_id,
    firearm_label, 'The firearm component layout was updated.', null, null,
    jsonb_build_object('operation', 'LAYOUT_UPDATE')
  );
end;
$$;

revoke all on function public.record_firearm_layout_audit(uuid) from public;
grant execute on function public.record_firearm_layout_audit(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
