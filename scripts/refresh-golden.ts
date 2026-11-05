import {createClient} from '@supabase/supabase-js';
import {GOLDEN_BASE} from '../lib/attendance/golden';
import {parseGoldenRoster} from '../lib/golden/parse';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Golden Squad sync requires server-side Supabase configuration');
const response=await fetch(`${GOLDEN_BASE}/classement`,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{'User-Agent':'Sanserif-Matchday/1.0'}});
if(!response.ok)throw new Error(`Golden Squad returned HTTP ${response.status}`);
if(!(response.headers.get('content-type')??'').includes('text/html'))throw new Error('Unexpected Golden Squad response type');
const html=await response.text();
if(html.length>3_000_000)throw new Error('Unexpected Golden Squad response size');
const players=parseGoldenRoster(html);
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await client.rpc('import_golden_roster',{p_players:players});
if(error)throw new Error('Golden Squad database import failed; previous roster retained');
console.log(`Verified Golden Squad directory: ${players.length} players. No names or photos logged.`);
