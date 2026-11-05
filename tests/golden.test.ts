import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGoldenRoster} from '../lib/golden/parse';
import {goldenCardUrl,goldenPortrait} from '../lib/attendance/golden';
const row=(id:number,photo='')=>`<a href="/sanserif-fc-r7vzcq/joueur/${id}"><span class="leaderboard__name">Test player ${id}</span><span class="leaderboard__position">MC</span>${photo?`<img src="${photo}">`:''}</a>`;
const html=(rows:string)=>`<html><head><title>Classement · Golden Squad</title></head><body><h1>CLASSEMENT</h1>${rows}</body></html>`;
const rows=Array.from({length:33},(_,i)=>row(i+1)).join('');
test('published roster names and photo URLs are parsed; absent photos stay absent',()=>{
  const players=parseGoldenRoster(html(rows));assert.equal(players.length,33);assert.equal(players[0].photo_url,null);
  const image='https://6q9heyh4no23cgi4.public.blob.vercel-storage.com/teams/1/players/test-photo.webp';
  const withPhoto=parseGoldenRoster(html(rows.replace(row(1),row(1,image))));assert.equal(withPhoto[0].photo_url,image);
});
test('truncation, wrong pages, duplicate IDs, partial rosters and foreign images are rejected',()=>{
  for(const body of [html(rows).replace('</html>',''),html(rows).replace('Classement · Golden Squad','Sign in'),html(rows+row(1)),html(row(1)),html(rows.replace(row(1),row(1,'https://wrong.test/photo.jpg')))])assert.throws(()=>parseGoldenRoster(body));
});
test('profile links and attendance pictures use explicit player IDs, never similar names',()=>{
  assert.equal(goldenCardUrl('31'),'https://golden-boy-seven.vercel.app/sanserif-fc-r7vzcq/joueur/31');
  assert.throws(()=>goldenCardUrl('../admin'));
  const players=[{id:'1',display_name:'Same name',position:'MC',photo_url:'image-one',source_checked_at:''},{id:'2',display_name:'Same name',position:'MC',photo_url:'image-two',source_checked_at:''}];
  assert.equal(goldenPortrait('member',players,[{user_id:'member',player_id:'2'}]),'image-two');
  assert.equal(goldenPortrait('unlinked',players,[{user_id:'member',player_id:'2'}]),undefined);
});
