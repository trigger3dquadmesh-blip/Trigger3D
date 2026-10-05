begin;

alter table public.audit_events add column if not exists academic_term_id uuid references public.academic_terms(id) on delete set null;
alter table public.audit_events add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.audit_events add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists audit_events_academic_term_idx on public.audit_events (academic_term_id, created_at desc);
create index if not exists audit_events_class_idx on public.audit_events (class_id, created_at desc);

update public.audit_events ae
set class_id = c.id, academic_term_id = c.academic_term_id
from public.classes c
where ae.entity_type = 'class' and ae.entity_id = c.id
  and (ae.class_id is null or ae.academic_term_id is null);

create or replace function private.record_term_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_class_id uuid;
  row_term_id uuid;
  row_entity_id uuid;
  row_event_type text;
  row_label text;
  row_reason text;
  class_name text;
  related_name text;
begin
  if tg_table_name = 'academic_terms' then
    row_term_id := coalesce(new.id, old.id);
    row_entity_id := row_term_id;
    row_event_type := case
      when tg_op = 'INSERT' then 'Academic term created'
      when new.status = 'closed' and old.status is distinct from new.status then 'Academic term closed'
      when new.status = 'active' and old.status is distinct from new.status then 'Academic term activated'
      else 'Academic term updated'
    end;
    row_label := coalesce(new.semester, old.semester) || ', AY ' || coalesce(new.academic_year, old.academic_year);
    row_reason := 'The academic-term configuration was changed.';
  elsif tg_table_name = 'classes' then
    row_class_id := coalesce(new.id, old.id);
    row_term_id := coalesce(new.academic_term_id, old.academic_term_id);
    row_entity_id := row_class_id;
    row_label := coalesce(new.name, old.name);
    row_event_type := case
      when tg_op = 'INSERT' then 'Class created'
      when new.archived_at is not null and old.archived_at is null then 'Class archived'
      when new.archived_at is null and old.archived_at is not null then 'Class restored'
      else 'Class updated'
    end;
    row_reason := 'A faculty class offering was changed.';
  elsif tg_table_name = 'enrollments' then
    row_class_id := coalesce(new.class_id, old.class_id);
    row_entity_id := coalesce(new.id, old.id);
    select c.academic_term_id, c.name into row_term_id, class_name from public.classes c where c.id = row_class_id;
    select coalesce(p.full_name, p.email, 'Student') into related_name from public.profiles p where p.id = coalesce(new.student_id, old.student_id);
    row_label := coalesce(related_name, 'Student') || ' · ' || coalesce(class_name, 'Class');
    row_event_type := case
      when tg_op = 'INSERT' then 'Student enrolled'
      when new.status = 'removed' and old.status is distinct from new.status then 'Student removed'
      when new.status = 'active' and old.status is distinct from new.status then 'Student re-admitted'
      else 'Enrollment updated'
    end;
    row_reason := 'The student roster for this class was changed.';
  elsif tg_table_name = 'assessment_releases' then
    row_class_id := coalesce(new.class_id, old.class_id);
    row_entity_id := coalesce(new.firearm_id, old.firearm_id);
    select c.academic_term_id, c.name into row_term_id, class_name from public.classes c where c.id = row_class_id;
    select f.name into related_name from public.firearms f where f.id = row_entity_id;
    row_label := coalesce(related_name, 'Assessment') || ' · ' || coalesce(class_name, 'Class');
    row_event_type := case when new.is_open then 'Assessment opened' else 'Assessment closed' end;
    row_reason := 'Assessment availability was changed for this class.';
  elsif tg_table_name = 'assessment_attempts' then
    if tg_op = 'UPDATE'
      and old.status is not distinct from new.status
      and old.integrity_locked_at is not distinct from new.integrity_locked_at then
      return new;
    end if;
    if tg_op = 'DELETE' then
      row_class_id := old.class_id;
      row_entity_id := old.id;
    else
      row_class_id := new.class_id;
      row_entity_id := new.id;
    end if;
    select c.academic_term_id, c.name into row_term_id, class_name from public.classes c where c.id = row_class_id;
    select f.name into related_name from public.firearms f where f.id = case when tg_op = 'DELETE' then old.firearm_id else new.firearm_id end;
    row_label := coalesce(related_name, 'Assessment') || ' · ' || coalesce(class_name, 'Class');
    row_event_type := case
      when tg_op = 'DELETE' then 'Assessment attempt reset'
      when new.integrity_locked_at is not null and old.integrity_locked_at is null then 'Assessment access locked'
      when new.status = 'submitted' and old.status is distinct from new.status then 'Assessment submitted'
      when old.status = 'submitted' and new.status is distinct from old.status then 'Assessment attempt reset'
      else 'Assessment attempt updated'
    end;
    row_reason := case
      when row_event_type = 'Assessment access locked' then 'The assessment integrity rules locked this attempt.'
      when row_event_type = 'Assessment attempt reset' then 'Faculty reset this specific student assessment attempt.'
      else 'The student assessment status changed.'
    end;
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.audit_events (
    actor_id, event_type, entity_type, entity_id, record_label, reason,
    academic_term_id, class_id, details
  ) values (
    auth.uid(), row_event_type, tg_table_name, row_entity_id, row_label, row_reason,
    row_term_id, row_class_id,
    jsonb_build_object('operation', tg_op, 'table', tg_table_name)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_academic_terms on public.academic_terms;
create trigger audit_academic_terms after insert or update on public.academic_terms
for each row execute function private.record_term_audit_event();

drop trigger if exists audit_classes_by_term on public.classes;
create trigger audit_classes_by_term after insert or update on public.classes
for each row execute function private.record_term_audit_event();

drop trigger if exists audit_enrollments_by_term on public.enrollments;
create trigger audit_enrollments_by_term after insert or update on public.enrollments
for each row execute function private.record_term_audit_event();

drop trigger if exists audit_assessment_releases_by_term on public.assessment_releases;
create trigger audit_assessment_releases_by_term after insert or update on public.assessment_releases
for each row execute function private.record_term_audit_event();

drop trigger if exists audit_assessment_attempts_by_term on public.assessment_attempts;
create trigger audit_assessment_attempts_by_term after update or delete on public.assessment_attempts
for each row execute function private.record_term_audit_event();

commit;
notify pgrst, 'reload schema';
