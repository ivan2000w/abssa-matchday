begin;
-- Small, re-encoded thumbnails stay behind the same membership boundary as RSVPs.
-- Separate metadata reads avoid downloading every image on each calendar refresh.
create table public.team_member_photos (
  user_id uuid primary key references public.team_members(user_id) on delete cascade,
  photo text not null check (length(photo) between 200 and 90000),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.team_member_photos enable row level security;
revoke all on public.team_member_photos from public,anon,authenticated;
grant select on public.team_member_photos to authenticated;
create policy photos_read on public.team_member_photos for select to authenticated using (
  team_private.is_member() and exists (
    select 1 from public.team_members m where m.user_id=team_member_photos.user_id and m.status='approved'
  )
);
create function public.set_profile_photo(p_photo text) returns void
language plpgsql security definer set search_path='' as $$
declare bytes bytea;
begin
  perform pg_advisory_xact_lock(7092026);
  if not team_private.is_member() then raise exception 'Team approval is required.'; end if;
  if p_photo is null then
    delete from public.team_member_photos where user_id=auth.uid();
    return;
  end if;
  if length(p_photo) not between 200 and 90000 or p_photo !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Choose a valid, resized JPEG photo.';
  end if;
  bytes := decode(substr(p_photo,24),'base64');
  if octet_length(bytes)<128 or substring(bytes from 1 for 3)<>decode('ffd8ff','hex')
    or substring(bytes from octet_length(bytes)-1 for 2)<>decode('ffd9','hex') then
    raise exception 'Choose a valid JPEG photo.';
  end if;
  insert into public.team_member_photos(user_id,photo) values(auth.uid(),p_photo)
    on conflict(user_id) do update set photo=excluded.photo,updated_at=clock_timestamp();
end;
$$;
revoke all on function public.set_profile_photo(text) from public,anon;
grant execute on function public.set_profile_photo(text) to authenticated;
commit;
