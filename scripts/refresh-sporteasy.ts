import { parseSportEasyCalendar } from '../lib/attendance/calendar';

// Private inputs come only from server/GitHub secrets; no calendar or roster files are committed.
async function main() {
  const source=process.env.SPORTEASY_CALENDAR_URL;
  const base=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!source||!base||!key)throw new Error('Missing private calendar configuration');
  const url=new URL(source.replace(/^webcal:/,'https:'));
  if(url.protocol!=='https:'||url.hostname!=='calendar.sporteasy.net')throw new Error('Unsupported calendar source');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error('SportEasy unavailable');
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty calendar response');
  let bytes=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000){await reader.cancel();throw new Error('Calendar too large');}chunks.push(value);}
  const events=parseSportEasyCalendar(Buffer.concat(chunks).toString('utf8'));
  const result=await fetch(new URL('/rest/v1/rpc/import_team_calendar',base),{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({p_events:events}),signal:AbortSignal.timeout(30_000),
  });
  if(!result.ok)throw new Error('Database rejected the calendar import');
  const imported=await result.json();
  if(imported!==events.length)throw new Error('Import count did not match');
  console.log(`Validated and imported ${imported} exported events. Events missing from this partial feed were preserved.`);
}
// Never log fetch exceptions: they can contain the private subscription URL.
main().catch(()=>{console.error('SportEasy refresh failed. Check source availability and private configuration. Failed validation never replaces saved events.');process.exitCode=1;});
