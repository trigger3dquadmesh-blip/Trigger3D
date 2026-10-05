begin;

alter table public.audit_events
  add column if not exists academic_term_id uuid references public.academic_terms(id) on delete set null;
alter table public.audit_events
  add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.audit_events
  add column if not exists details jsonb not null default '{}'::jsonb;

create or replace function private.record_academic_term_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_event_type text;
  audit_reason text;
begin
  audit_event_type := case
    when tg_op = 'INSERT' then 'Academic term created'
    when new.status = 'closed' and old.status is distinct from new.status then 'Academic term closed'
    when new.status = 'active' and old.status is distinct from new.status then 'Academic term activated'
    else 'Academic term updated'
  end;

  audit_reason := case audit_event_type
    when 'Academic term created' then 'The administrator created a new academic term.'
    when 'Academic term closed' then 'The administrator closed this academic term and preserved its classes as historical records.'
    when 'Academic term activated' then 'The administrator made this the active academic term.'
    else 'The administrator corrected the academic-term information.'
  end;

  insert into public.audit_events (
    actor_id,
    event_type,
    entity_type,
    entity_id,
    record_label,
    reason,
    academic_term_id,
    class_id,
    details
  ) values (
    auth.uid(),
    audit_event_type,
    'academic_terms',
    new.id,
    new.semester || ', AY ' || new.academic_year,
    audit_reason,
    new.id,
    null,
    jsonb_build_object(
      'operation', tg_op,
      'table', 'academic_terms',
      'status', new.status,
      'academic_year', new.academic_year,
      'semester', new.semester
    )
  );

  return new;
end;
$$;

drop trigger if exists audit_academic_terms on public.academic_terms;
create trigger audit_academic_terms
after insert or update on public.academic_terms
for each row execute function private.record_academic_term_audit_event();

insert into public.audit_events (
  actor_id,
  event_type,
  entity_type,
  entity_id,
  record_label,
  reason,
  academic_term_id,
  class_id,
  details,
  created_at
)
select
  term.created_by,
  'Academic term created',
  'academic_terms',
  term.id,
  term.semester || ', AY ' || term.academic_year,
  'The administrator created a new academic term.',
  term.id,
  null,
  jsonb_build_object(
    'operation', 'BACKFILL',
    'table', 'academic_terms',
    'status', term.status,
    'academic_year', term.academic_year,
    'semester', term.semester
  ),
  term.created_at
from public.academic_terms term
where not exists (
  select 1
  from public.audit_events event
  where event.entity_type in ('academic_terms', 'term')
    and event.entity_id = term.id
    and event.event_type = 'Academic term created'
);

commit;
notify pgrst, 'reload schema';
