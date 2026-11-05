import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSportEasyCalendar} from '../lib/attendance/calendar';

const event=(body:string)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-only\r\nSUMMARY:Test-only event\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
test('SportEasy times respect Belgian winter and summer offsets',()=>{
  const winter=parseSportEasyCalendar(event('DTSTART;TZID=Europe/Brussels:20261111T203000\r\nDTEND;TZID=Europe/Brussels:20261111T220000'))[0];
  const summer=parseSportEasyCalendar(event('DTSTART;TZID=Europe/Brussels:20260812T203000\r\nDTEND;TZID=Europe/Brussels:20260812T220000'))[0];
  assert.equal(winter.starts_at,'2026-11-11T19:30:00.000Z');assert.equal(summer.starts_at,'2026-08-12T18:30:00.000Z');
});
test('cancelled and folded calendar events retain their source meaning',()=>{
  const source=event('DTSTART:20261111T193000Z\r\nSTATUS:CANCELLED\r\nLOCATION:Test-only long\r\n  venue');
  const row=parseSportEasyCalendar(source)[0];assert.equal(row.status,'cancelled');assert.equal(row.location,'Test-only long venue');
});
test('partial, empty, floating and unsupported recurring exports fail closed',()=>{
  assert.throws(()=>parseSportEasyCalendar(event('DTSTART:20261111T193000Z').replace('END:VCALENDAR','')));
  assert.throws(()=>parseSportEasyCalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR'));
  assert.throws(()=>parseSportEasyCalendar(event('DTSTART:20261111T193000')));
  assert.throws(()=>parseSportEasyCalendar(event('DTSTART:20261111T193000Z\r\nRRULE:FREQ=WEEKLY')));
});
