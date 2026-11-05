import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Postgres enforces private membership, own RSVP and coach-only squad selection', async (t) => {
  const db = new PGlite();
  const coach = '00000000-0000-4000-8000-000000000001';
  const player = '00000000-0000-4000-8000-000000000002';
  const outsider = '00000000-0000-4000-8000-000000000003';
  const unverified = '00000000-0000-4000-8000-000000000004';
  const event = '00000000-0000-4000-8000-000000000010';
  const as = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611050001_attendance.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611050002_calendar_import.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611050003_profile_photos.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611050004_golden_squad.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,null)',
      [coach,'coach@example.test',player,'player@example.test',outsider,'outsider@example.test',unverified,'unverified@example.test']);
    await db.exec("insert into team_private.bootstrap_coach values ('coach@example.test')");
    await db.query("insert into public.team_events(id,source_uid,title,starts_at) values($1,'test-event','Test-only training',now()+interval '7 days')",[event]);
    await t.test('anonymous visitors cannot read private events',async()=>{
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from public.team_events'), /permission denied/);
      await assert.rejects(db.query('select * from public.team_member_photos'), /permission denied/);
      await assert.rejects(db.query('select public.set_profile_photo(null)'), /permission denied/);
    });
    await t.test('email verification is mandatory',async()=>{
      await as(unverified);
      await assert.rejects(db.query("select public.join_team('Not verified')"), /Verify your email/);
    });
    await t.test('bootstrap coach is verified; other signups are pending',async()=>{
      await as(coach); await db.query("select public.join_team('Coach')");
      assert.equal((await db.query<{role:string}>('select role from public.team_members')).rows[0].role,'coach');
      await as(player); await db.query("select public.join_team('Player')");
      assert.equal((await db.query<{status:string}>('select status from public.team_members')).rows[0].status,'pending');
      assert.equal((await db.query('select * from public.team_events')).rows.length,0);
      await assert.rejects(db.query("select public.set_availability($1,'available')",[event]),/approval/);
      await assert.rejects(db.query('select public.set_profile_photo(null)'),/approval/);
      await assert.rejects(db.query("update public.team_members set role='coach'"),/permission denied/);
      await assert.rejects(db.query("select public.manage_team_member($1,'approve')",[player]),/Only coaches/);
    });
    await t.test('approved players can RSVP only as themselves and cannot select squads',async()=>{
      await as(coach); await db.query("select public.manage_team_member($1,'approve')",[player]);
      await as(player); await db.query("select public.set_availability($1,'available')",[event]);
      const rows=(await db.query<{user_id:string}>('select * from public.team_responses')).rows;
      assert.equal(rows.length,1); assert.equal(rows[0].user_id,player);
      await assert.rejects(db.query('update public.team_responses set user_id=$1',[coach]),/permission denied/);
      await assert.rejects(db.query('select public.select_squad($1,$2,true)',[event,player]),/Only coaches/);
    });
    await t.test('squad selection is independent of availability and visible to members',async()=>{
      await as(coach); await db.query('select public.select_squad($1,$2,true)',[event,player]);
      await as(player);
      assert.equal((await db.query('select * from public.team_squad')).rows.length,1);
      await db.query("select public.set_availability($1,'unavailable')",[event]);
      assert.equal((await db.query('select * from public.team_squad')).rows.length,1);
      await as(outsider); await db.query("select public.join_team('Outsider')");
      assert.equal((await db.query('select * from public.team_squad')).rows.length,0);
      assert.equal((await db.query('select * from public.team_responses')).rows.length,0);
    });
    await t.test('photos are private, self-owned, bounded JPEGs and removable',async()=>{
      const jpeg='data:image/jpeg;base64,'+(await readFile(new URL('../public/clubs/zijp-fc.jpg',import.meta.url))).toString('base64');
      await as(player);
      await db.query('select public.set_profile_photo($1)',[jpeg]);
      assert.equal((await db.query<{user_id:string}>('select user_id from public.team_member_photos')).rows[0].user_id,player);
      await assert.rejects(db.query('update public.team_member_photos set user_id=$1',[coach]),/permission denied/);
      await assert.rejects(db.query('select public.set_profile_photo($1,$2)',[coach,jpeg]),/does not exist/);
      for(const invalid of ['https://example.test/photo.jpg','data:image/svg+xml;base64,'+'A'.repeat(300),'data:image/jpeg;base64,'+'A'.repeat(300),jpeg+'A'.repeat(90000)])
        await assert.rejects(db.query('select public.set_profile_photo($1)',[invalid]),/JPEG/);
      await as(coach);
      assert.equal((await db.query<{photo:string}>('select photo from public.team_member_photos')).rows[0].photo,jpeg);
      await db.query('select public.set_profile_photo($1)',[jpeg]);
      await as(outsider);
      assert.equal((await db.query('select * from public.team_member_photos')).rows.length,0);
      await assert.rejects(db.query('select public.set_profile_photo($1)',[jpeg]),/approval/);
      await as(player);
      await db.query('select public.set_profile_photo(null)');
      assert.deepEqual((await db.query<{user_id:string}>('select user_id from public.team_member_photos')).rows.map(r=>r.user_id),[coach]);
    });
    await t.test('Golden Squad imports fail closed and approved members link only their own account',async()=>{
      const catalog=Array.from({length:26},(_,i)=>({id:String(i+1),display_name:`Test player ${i+1}`,position:'MC',photo_url:null}));
      await as(player);
      await assert.rejects(db.query('select public.import_golden_roster($1::jsonb)',[JSON.stringify(catalog)]),/permission denied/);
      await db.exec('reset role; set role service_role');
      await db.query('select public.import_golden_roster($1::jsonb)',[JSON.stringify(catalog)]);
      await assert.rejects(db.query('select public.import_golden_roster(null)'),/Invalid roster/);
      await assert.rejects(db.query('select public.import_golden_roster($1::jsonb)',[JSON.stringify(catalog.slice(0,3))]),/Incomplete roster/);
      const invalid: {id:string;display_name:string;position:string;photo_url:string|null}[]=catalog.map(p=>({...p}));invalid[25].photo_url='https://wrong.test/photo.jpg';
      await assert.rejects(db.query('select public.import_golden_roster($1::jsonb)',[JSON.stringify(invalid)]),/check constraint/);
      await as(outsider);
      assert.equal((await db.query('select * from public.golden_players')).rows.length,0);
      await assert.rejects(db.query("select public.link_golden_player('1')"),/approval/);
      await as(coach); await db.query("select public.link_golden_player('1')");
      await as(player); assert.equal((await db.query('select * from public.golden_players')).rows.length,26);
      await assert.rejects(db.query("select public.link_golden_player('1')"),/already connected/);
      await db.query("select public.link_golden_player('2')");
      assert.equal((await db.query<{player_id:string}>('select player_id from public.golden_member_links where user_id=$1',[player])).rows[0].player_id,'2');
      await assert.rejects(db.query("update public.golden_member_links set player_id='3'"),/permission denied/);
      await assert.rejects(db.query('select public.unlink_golden_member($1)',[coach]),/Only coaches/);
      await as(coach);await db.query('select public.unlink_golden_member($1)',[player]);
      await as(player);await db.query("select public.link_golden_player('26')");
      await db.exec('reset role; set role service_role');
      await db.query('select public.import_golden_roster($1::jsonb)',[JSON.stringify(catalog.slice(0,25))]);
      await as(player);assert.equal((await db.query('select * from public.golden_players')).rows.length,25);
      await assert.rejects(db.query("select public.link_golden_player('26')"),/no longer available/);
      await db.query('select public.link_golden_player(null)');
      assert.equal((await db.query('select * from public.golden_member_links where user_id=$1',[player])).rows.length,0);
    });
    await t.test('coach can transfer role but cannot remove the last coach',async()=>{
      await as(coach);
      await assert.rejects(db.query("select public.manage_team_member($1,'demote')",[coach]),/last coach/);
      await db.query("select public.manage_team_member($1,'promote')",[player]);
      await db.query("select public.manage_team_member($1,'demote')",[coach]);
      await assert.rejects(db.query('select public.select_squad($1,$2,false)',[event,player]),/Only coaches/);
      await as(player); await db.query('select public.select_squad($1,$2,false)',[event,player]);
      assert.equal((await db.query('select * from public.team_squad')).rows.length,0);
    });
    await t.test('revoked accounts lose access immediately and cannot rejoin themselves',async()=>{
      await as(player); await db.query("select public.manage_team_member($1,'remove')",[coach]);
      await as(coach); await db.query("select public.join_team('Coach again')");
      assert.equal((await db.query('select * from public.team_member_photos')).rows.length,0);
      assert.equal((await db.query('select * from public.team_events')).rows.length,0);
      await assert.rejects(db.query("select public.set_availability($1,'available')",[event]),/approval/);
      await assert.rejects(db.query('select public.set_profile_photo(null)'),/approval/);
    });
    await t.test('closed events reject new RSVPs',async()=>{
      await db.exec('reset role');
      await db.query("update public.team_events set status='cancelled' where id=$1",[event]);
      await as(player);
      await assert.rejects(db.query("select public.set_availability($1,'available')",[event]),/not open/);
    });
    await t.test('only the server imports calendars; malformed batches roll back entirely',async()=>{
      const entry={source_uid:'import-test',title:'Test-only fixture',starts_at:new Date(Date.now()+86_400_000*10).toISOString(),ends_at:null,location:'Test-only venue',status:'scheduled'};
      await assert.rejects(db.query('select public.import_team_calendar($1::jsonb)',[JSON.stringify([entry])]),/permission denied/);
      await db.exec('reset role; set role service_role');
      await assert.rejects(db.query('select public.import_team_calendar($1::jsonb)',[JSON.stringify([entry,{...entry,source_uid:'bad',title:''}])]),/invalid event/);
      await db.exec('reset role');
      assert.equal((await db.query("select * from public.team_events where source_uid='import-test'")).rows.length,0);
      await db.exec('set role service_role');
      await db.query('select public.import_team_calendar($1::jsonb)',[JSON.stringify([entry])]);
      await db.exec('reset role');
      assert.equal((await db.query('select * from public.team_events')).rows.length,2); // Missing rows are preserved.
      let rev=()=>db.query<{revision:number}>("select revision from public.team_events where source_uid='import-test'");
      assert.equal((await rev()).rows[0].revision,1);
      await db.exec('set role service_role');
      await db.query('select public.import_team_calendar($1::jsonb)',[JSON.stringify([entry])]);
      await db.exec('reset role');assert.equal((await rev()).rows[0].revision,1);
      await db.exec('set role service_role');
      await db.query('select public.import_team_calendar($1::jsonb)',[JSON.stringify([{...entry,location:'Changed venue'}])]);
      await db.exec('reset role');assert.equal((await rev()).rows[0].revision,2);
    });
  } finally { await db.close(); }
});
