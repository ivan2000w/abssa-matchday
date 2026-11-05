import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventClubs} from '../lib/attendance/event-clubs';
import {prepareProfilePhoto} from '../lib/attendance/photo';

test('calendar aliases resolve exactly and preserve the published team order',()=>{
  assert.deepEqual(eventClubs('Cosmos Bruwolf 1 / SANSERIF FC - ABSSA'),['COSMOS BRUWOLF MJ 1','SANSERIF FC']);
  assert.deepEqual(eventClubs('SANSERIF FC - Friends Spirit'),['SANSERIF FC','FRIENDS SPIRIT AUD']);
  assert.deepEqual(eventClubs('SANSERIF FC - Bleu-Blanc Entr.'),['SANSERIF FC','BLEU-BLANC (ENT)R.']);
  assert.deepEqual(eventClubs('String Pénélope 2 - SANSERIF FC'),['STRING PENELOPE 2','SANSERIF FC']);
  assert.deepEqual(eventClubs('SANSERIF FC vs. Tiekss Wemmel'),['SANSERIF FC','TIEKSS WEMMEL']);
});
test('unknown clubs, other reserve teams and social events never get guessed badges',()=>{
  for(const title of ['Entrainement','SANSERIF FC - Team building','SANSERIF FC - Watermael FC 1','SANSERIF FC - Unknown team','Picardie AS 2 / SANSERIF FC','SANSERIF FC - SANSERIF FC'])assert.equal(eventClubs(title),null,title);
});
test('unsupported or oversized photo uploads are rejected before image decoding',async()=>{
  await assert.rejects(prepareProfilePhoto(new File(['<svg/>'],'photo.svg',{type:'image/svg+xml'})),/JPG/);
  await assert.rejects(prepareProfilePhoto(new File([new Uint8Array(8*1024*1024+1)],'large.jpg',{type:'image/jpeg'})),/8 MB/);
});
