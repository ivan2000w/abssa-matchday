import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAbssa } from '../lib/abssa/collector';
import { saveVerifiedSnapshot } from './snapshot-store';
import type { AbssaSnapshot } from '../lib/abssa/types';

const output = fileURLToPath(new URL('../public/data/abssa.json',import.meta.url));
const previous = JSON.parse(await readFile(output,'utf8')) as AbssaSnapshot;
let failure: unknown;
for (let attempt=1;attempt<=3;attempt++) {
  const directory = await mkdtemp(join(tmpdir(),'abssa-session-'));
  const jar = join(directory,'cookies');
  try {
    const candidate = await collectAbssa(previous,async (url,init={}) => {
      if (new URL(url).origin !== 'https://www.abssa.be') throw new Error('Unexpected source host');
      const args=['--silent','--show-error','--location','--fail','--proto','=https','--proto-redir','=https','--connect-timeout','10','--max-time','25','--cookie',jar,'--cookie-jar',jar,'--user-agent','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'];
      for (const [key,value] of new Headers(init.headers)) args.push('--header',`${key}: ${value}`);
      if (init.method) args.push('--request',init.method);
      if (typeof init.body === 'string') args.push('--data-raw',init.body);
      args.push(url);
      return execFileSync('curl',args,{encoding:'utf8',maxBuffer:5_000_000});
    });
    await saveVerifiedSnapshot(output,candidate);
    console.log(JSON.stringify({ok:true,sourceStatus:candidate.sourceStatus,fetchedAt:candidate.fetchedAt,matches:candidate.matches.length,results:candidate.matches.filter(m=>m.status==='final').length,teams:candidate.standings.length}));
    failure=undefined;break;
  } catch(error) {
    failure=error;
    console.error(`ABSSA attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if(attempt<3) await new Promise(resolve=>setTimeout(resolve,attempt*5000));
  } finally { await rm(directory,{recursive:true,force:true}); }
}
if(failure) { console.error('Refresh failed. The last verified snapshot was left untouched.'); process.exitCode=1; }
