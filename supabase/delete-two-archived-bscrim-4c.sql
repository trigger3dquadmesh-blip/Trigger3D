do $$
declare
  target_count integer;
  owner_count integer;
begin
  select count(*), count(distinct faculty_id)
  into target_count, owner_count
  from public.classes
  where archived_at is not null
    and name = 'BSCRIM - 4C'
    and term in ('Current term', '2026-1');

  if target_count <> 2 or owner_count <> 1 then
    raise exception 'Safety check stopped deletion: expected exactly two archived BSCRIM - 4C classes owned by one faculty account, found % classes across % owners.', target_count, owner_count;
  end if;

  delete from public.classes
  where archived_at is not null
    and name = 'BSCRIM - 4C'
    and term in ('Current term', '2026-1');
end;
$$;
