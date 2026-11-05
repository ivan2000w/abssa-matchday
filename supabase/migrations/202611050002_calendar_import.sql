begin;
create function public.import_team_calendar(p_events jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare item jsonb; total integer; stamp timestamptz := now();
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 1500 then
    raise exception 'Calendar import must contain 1–1500 verified events.';
  end if;
  if (select count(distinct value->>'source_uid') from jsonb_array_elements(p_events)) <> jsonb_array_length(p_events) then
    raise exception 'Calendar contains duplicate event identifiers.';
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
    if coalesce(length(item->>'source_uid'),0) not between 1 and 200
      or coalesce(length(item->>'title'),0) not between 1 and 300
      or (item->>'starts_at')::timestamptz is null
      or coalesce(item->>'status','') not in ('scheduled','cancelled') then
      raise exception 'Calendar contains an invalid event.';
    end if;
    insert into public.team_events(source_uid,title,starts_at,ends_at,location,status,source_checked_at)
      values(item->>'source_uid',item->>'title',(item->>'starts_at')::timestamptz,
        (item->>'ends_at')::timestamptz,coalesce(item->>'location',''),item->>'status',stamp)
      on conflict(source_uid) do update set
        revision = public.team_events.revision + case when
          (public.team_events.starts_at,public.team_events.ends_at,public.team_events.location,public.team_events.status)
          is distinct from (excluded.starts_at,excluded.ends_at,excluded.location,excluded.status) then 1 else 0 end,
        title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
        location=excluded.location,status=excluded.status,source_checked_at=stamp;
  end loop;
  -- A player feed is a subset: absence NEVER means cancelled/deleted.
  total := jsonb_array_length(p_events);
  return total;
end;
$$;
revoke all on function public.import_team_calendar(jsonb) from public,anon,authenticated;
grant execute on function public.import_team_calendar(jsonb) to service_role;
commit;
