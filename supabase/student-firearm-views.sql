create table if not exists public.student_firearm_views (
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  firearm_id uuid not null references public.firearms(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (student_id, class_id, firearm_id)
);

alter table public.student_firearm_views enable row level security;

drop policy if exists "Students read own firearm views" on public.student_firearm_views;
create policy "Students read own firearm views"
on public.student_firearm_views for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students record own active-class firearm views" on public.student_firearm_views;
create policy "Students record own active-class firearm views"
on public.student_firearm_views for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    where enrollment.student_id = auth.uid()
      and enrollment.class_id = student_firearm_views.class_id
      and enrollment.status = 'active'
      and class_record.archived_at is null
  )
);

drop policy if exists "Students refresh own firearm views" on public.student_firearm_views;
create policy "Students refresh own firearm views"
on public.student_firearm_views for update
to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    where enrollment.student_id = auth.uid()
      and enrollment.class_id = student_firearm_views.class_id
      and enrollment.status = 'active'
      and class_record.archived_at is null
  )
);

create index if not exists student_firearm_views_class_idx
on public.student_firearm_views (class_id, student_id);

grant select, insert, update on public.student_firearm_views to authenticated;
