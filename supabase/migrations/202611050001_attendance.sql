-- Private, single-team attendance. ABSSA public results remain independent.
begin;
create schema if not exists team_private;
revoke all on schema team_private from public, anon, authenticated;

create table public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 60),
  role text not null default 'player' check (role in ('player','coach')),
  status text not null default 'pending' check (status in ('pending','approved','removed')),
  created_at timestamptz not null default now()
);
create table public.team_events (
  id uuid primary key default gen_random_uuid(),
  source_uid text not null unique,
  title text not null check (length(title) between 1 and 300),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','unconfirmed')),
  revision integer not null default 1,
  source_checked_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create table public.team_responses (
  event_id uuid not null references public.team_events(id),
  user_id uuid not null references public.team_members(user_id),
  response text not null check (response in ('available','unavailable','maybe')),
  event_revision integer not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table public.team_squad (
  event_id uuid not null references public.team_events(id),
  user_id uuid not null references public.team_members(user_id),
  selected_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
-- Populated privately at deployment, never from browser-supplied user metadata.
create table team_private.bootstrap_coach (email text primary key);

create function team_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.team_members where user_id = auth.uid() and status = 'approved');
$$;
create function team_private.is_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.team_members where user_id = auth.uid() and status = 'approved' and role = 'coach');
$$;
grant usage on schema team_private to authenticated;
revoke all on all functions in schema team_private from public, anon, authenticated;
grant execute on function team_private.is_member(), team_private.is_coach() to authenticated;

alter table public.team_members enable row level security;
alter table public.team_events enable row level security;
alter table public.team_responses enable row level security;
alter table public.team_squad enable row level security;
revoke all on public.team_members, public.team_events, public.team_responses, public.team_squad from public, anon, authenticated;
grant select on public.team_members, public.team_events, public.team_responses, public.team_squad to authenticated;
create policy members_read on public.team_members for select to authenticated using (
  user_id = auth.uid() or team_private.is_coach() or (status = 'approved' and team_private.is_member())
);
create policy events_read on public.team_events for select to authenticated using (team_private.is_member());
create policy responses_read on public.team_responses for select to authenticated using (team_private.is_member());
create policy squad_read on public.team_squad for select to authenticated using (team_private.is_member());

create function public.join_team(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare verified_email text; bootstrap boolean;
begin
  select lower(email) into verified_email from auth.users
    where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verify your email before joining.'; end if;
  if length(trim(p_name)) not between 2 and 60 then raise exception 'Enter your name (2–60 characters).'; end if;
  perform pg_advisory_xact_lock(7092026);
  if exists(select 1 from public.team_members where user_id = auth.uid()) then return; end if;
  select exists(select 1 from team_private.bootstrap_coach where lower(email) = verified_email) into bootstrap;
  insert into public.team_members(user_id, display_name, role, status)
    values(auth.uid(), trim(p_name), case when bootstrap then 'coach' else 'player' end,
      case when bootstrap then 'approved' else 'pending' end);
  if bootstrap then delete from team_private.bootstrap_coach where lower(email) = verified_email; end if;
end;
$$;

create function public.manage_team_member(p_user uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.team_members;
begin
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_coach() then raise exception 'Only coaches can manage the team.'; end if;
  select * into target from public.team_members where user_id = p_user for update;
  if not found then raise exception 'Member not found.'; end if;
  if p_action not in ('approve','remove','promote','demote') then raise exception 'Invalid action.'; end if;
  if target.role = 'coach' and target.status = 'approved' and p_action in ('remove','demote')
    and (select count(*) from public.team_members where role = 'coach' and status = 'approved') <= 1
    then raise exception 'Add another coach before removing the last coach.'; end if;
  if p_action = 'promote' and target.status <> 'approved' then raise exception 'Approve the member first.'; end if;
  if p_action = 'approve' then
    update public.team_members set status = 'approved', role = case when target.status = 'approved' then role else 'player' end where user_id = p_user;
  elsif p_action = 'remove' then
    update public.team_members set status = 'removed', role = 'player' where user_id = p_user;
    delete from public.team_squad where user_id = p_user;
  elsif p_action = 'promote' then update public.team_members set role = 'coach' where user_id = p_user;
  elsif p_action = 'demote' then update public.team_members set role = 'player' where user_id = p_user;
  end if;
end;
$$;

create function public.set_availability(p_event uuid, p_response text) returns void
language plpgsql security definer set search_path = '' as $$
declare event public.team_events;
begin
  -- Same lock as member removal: a removed player cannot race an RSVP through.
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_member() then raise exception 'Team approval is required.'; end if;
  if p_response not in ('available','unavailable','maybe') then raise exception 'Invalid response.'; end if;
  select * into event from public.team_events where id = p_event for update;
  if not found or event.status <> 'scheduled' or event.starts_at <= now() then raise exception 'This event is not open for responses.'; end if;
  insert into public.team_responses(event_id,user_id,response,event_revision)
    values(p_event,auth.uid(),p_response,event.revision)
    on conflict(event_id,user_id) do update set response=excluded.response,event_revision=excluded.event_revision,updated_at=now();
end;
$$;

create function public.select_squad(p_event uuid, p_user uuid, p_selected boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare event public.team_events;
begin
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_coach() then raise exception 'Only coaches can select the squad.'; end if;
  select * into event from public.team_events where id=p_event for update;
  if not found or event.status <> 'scheduled' or event.starts_at <= now() then raise exception 'This event is closed.'; end if;
  if not exists(select 1 from public.team_members where user_id=p_user and status='approved') then raise exception 'Player must be an approved member.'; end if;
  if p_selected then
    insert into public.team_squad(event_id,user_id,selected_by) values(p_event,p_user,auth.uid())
      on conflict(event_id,user_id) do update set selected_by=excluded.selected_by,updated_at=now();
  else delete from public.team_squad where event_id=p_event and user_id=p_user;
  end if;
end;
$$;

revoke all on function public.join_team(text), public.manage_team_member(uuid,text), public.set_availability(uuid,text), public.select_squad(uuid,uuid,boolean) from public, anon;
grant execute on function public.join_team(text), public.manage_team_member(uuid,text), public.set_availability(uuid,text), public.select_squad(uuid,uuid,boolean) to authenticated;
commit;
