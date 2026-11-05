begin;
create table public.golden_players (
  id text primary key check(id ~ '^[1-9][0-9]{0,8}$'),
  display_name text not null check(length(display_name) between 2 and 100),
  position text not null check(length(position)<=20),
  photo_url text check(photo_url ~ '^https://6q9heyh4no23cgi4\.public\.blob\.vercel-storage\.com/(teams/1/)?players/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$'),
  active boolean not null default true,
  source_checked_at timestamptz not null default now()
);
create table public.golden_member_links (
  user_id uuid primary key references public.team_members(user_id) on delete cascade,
  player_id text not null unique references public.golden_players(id),
  linked_at timestamptz not null default now()
);
alter table public.golden_players enable row level security;
alter table public.golden_member_links enable row level security;
revoke all on public.golden_players,public.golden_member_links from public,anon,authenticated;
grant select on public.golden_players,public.golden_member_links to authenticated;
create policy golden_players_read on public.golden_players for select to authenticated using(team_private.is_member() and active);
create policy golden_links_read on public.golden_member_links for select to authenticated using(team_private.is_member());
create function public.link_golden_player(p_player text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_member() then raise exception 'Team approval is required.'; end if;
  if p_player is null then delete from public.golden_member_links where user_id=auth.uid(); return; end if;
  if not exists(select 1 from public.golden_players where id=p_player and active) then raise exception 'This player card is no longer available.'; end if;
  if exists(select 1 from public.golden_member_links where player_id=p_player and user_id<>auth.uid()) then raise exception 'This card is already connected. Ask a coach to correct the link.'; end if;
  insert into public.golden_member_links(user_id,player_id) values(auth.uid(),p_player)
    on conflict(user_id) do update set player_id=excluded.player_id,linked_at=now();
end;
$$;
create function public.unlink_golden_member(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_coach() then raise exception 'Only coaches can correct another member link.'; end if;
  delete from public.golden_member_links where user_id=p_user;
end;
$$;
create function public.import_golden_roster(p_players jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb; ids text[]:='{}'; count_rows integer;
begin
  perform pg_advisory_xact_lock(7092026);
  if jsonb_typeof(p_players) is distinct from 'array' then raise exception 'Invalid roster'; end if;
  count_rows:=jsonb_array_length(p_players);
  if count_rows not between 25 and 100 then raise exception 'Incomplete roster'; end if;
  if (select count(distinct p->>'id') from jsonb_array_elements(p_players) p)<>count_rows then raise exception 'Duplicate roster'; end if;
  for item in select * from jsonb_array_elements(p_players) loop
    if not(item ?& array['id','display_name','position','photo_url']) then raise exception 'Invalid roster row'; end if;
    ids:=array_append(ids,item->>'id');
    insert into public.golden_players(id,display_name,position,photo_url,active,source_checked_at)
      values(item->>'id',item->>'display_name',item->>'position',item->>'photo_url',true,now())
      on conflict(id) do update set display_name=excluded.display_name,position=excluded.position,photo_url=excluded.photo_url,active=true,source_checked_at=now();
  end loop;
  -- A complete verified roster can remove a retired profile/photo; a failed
  -- import rolls back atomically and never partially replaces the directory.
  update public.golden_players set active=false,photo_url=null,source_checked_at=now() where not(id=any(ids));
  return count_rows;
end;
$$;
revoke all on function public.link_golden_player(text),public.unlink_golden_member(uuid),public.import_golden_roster(jsonb) from public,anon,authenticated;
grant execute on function public.link_golden_player(text),public.unlink_golden_member(uuid) to authenticated;
grant execute on function public.import_golden_roster(jsonb) to service_role;
commit;
