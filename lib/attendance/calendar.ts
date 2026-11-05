import ical from 'node-ical';
export type ImportedEvent = {source_uid:string; title:string; starts_at:string; ends_at:string|null; location:string; status:'scheduled'|'cancelled'};
function text(value:unknown):string {
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'&&'val' in value&&typeof value.val==='string')return value.val;
  return '';
}
export function parseSportEasyCalendar(body:string):ImportedEvent[] {
  const unfolded=body.replace(/\r?\n[ \t]/g,'');
  if(body.length>2_000_000||!/^BEGIN:VCALENDAR\r?\n/.test(body)||!body.trimEnd().endsWith('END:VCALENDAR'))throw new Error('Incomplete calendar');
  const count=(unfolded.match(/^BEGIN:VEVENT\r?$/gm)||[]).length;
  if(!count||count>1500||(unfolded.match(/^END:VEVENT\r?$/gm)||[]).length!==count)throw new Error('Invalid event count');
  // This source currently exports individual, timed events. Fail closed if it changes format.
  if(/^(RRULE|RDATE|RECURRENCE-ID)[;:]/m.test(unfolded)||/^DTSTART;VALUE=DATE:/m.test(unfolded))throw new Error('Calendar format needs review; no import performed');
  for(const line of unfolded.split(/\r?\n/).filter(l=>/^DT(?:START|END)[;:]/.test(l))) {
    if(!/Z$/.test(line)&&!line.includes('TZID='))throw new Error('Calendar time zone missing');
    const tz=line.match(/TZID=([^;:]+)/)?.[1];
    if(tz)new Intl.DateTimeFormat('en',{timeZone:tz}).format();
  }
  const events=Object.values(ical.sync.parseICS(body)).filter(e=>e?.type==='VEVENT');
  if(events.length!==count)throw new Error('Duplicate or incomplete calendar events');
  return events.map(e=>{
    if(e?.type!=='VEVENT'||!e.uid||!e.start||!Number.isFinite(e.start.getTime())||!text(e.summary).trim())throw new Error('Invalid calendar event');
    const end=e.end;
    if(end&&(!Number.isFinite(end.getTime())||end<e.start))throw new Error('Invalid event end');
    if(e.uid.length>200||text(e.summary).length>300)throw new Error('Event exceeds supported limits');
    return {source_uid:e.uid,title:text(e.summary).trim(),starts_at:e.start.toISOString(),ends_at:end?.toISOString()||null,location:text(e.location),status:e.status==='CANCELLED'?'cancelled':'scheduled'};
  });
}
