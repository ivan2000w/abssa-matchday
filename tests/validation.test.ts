import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import snapshot from '../public/data/abssa.json';
import type { AbssaSnapshot } from '../lib/abssa/types';
import { validateSnapshot } from '../lib/abssa/validate';
import { saveVerifiedSnapshot } from '../scripts/snapshot-store';
const fresh=()=>({...structuredClone(snapshot),fetchedAt:new Date().toISOString()}) as AbssaSnapshot;
test('accepts the complete official snapshot',()=>assert.equal(validateSnapshot(fresh()).valid,true));
for(const [name,corrupt] of Object.entries({
  'incomplete matchday': (s:AbssaSnapshot)=>s.matches.pop(),
  'missing standings':(s:AbssaSnapshot)=>s.standings.pop(),
  'partial result':(s:AbssaSnapshot)=>{s.matches.find(m=>m.status==='final')!.awayScore=null;},
  'invalid kickoff':(s:AbssaSnapshot)=>{s.matches[0].time='29:90';},
  'duplicate teams':(s:AbssaSnapshot)=>{s.matches[0].home=s.matches[0].away;},
  'incorrect season':(s:AbssaSnapshot)=>{s.matches[0].date='2027-09-01';},
})) test(`rejects ${name}`,()=>{const s=fresh();corrupt(s);assert.equal(validateSnapshot(s).valid,false);});
test('invalid data never replaces the last verified file',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'abssa-test-'));const path=join(dir,'snapshot.json');
  try {const original=JSON.stringify(snapshot);await writeFile(path,original);const broken=fresh();broken.matches=[];await assert.rejects(saveVerifiedSnapshot(path,broken),/Validation/);assert.equal(await readFile(path,'utf8'),original);
  const valid=fresh();await saveVerifiedSnapshot(path,valid);assert.equal(JSON.parse(await readFile(path,'utf8')).fetchedAt,valid.fetchedAt);
  }finally{await rm(dir,{recursive:true,force:true});}
});
