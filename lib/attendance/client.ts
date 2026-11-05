import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Only publishable/anon credentials belong in a static build. Never service_role.
if (key && !key.startsWith('sb_publishable_')) throw new Error('The team app requires a Supabase publishable key.');
export const attendance = url && key ? createClient(url, key, {
  auth: { storageKey: 'sanserif-team-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export type Member = {user_id:string; display_name:string; role:'coach'|'player'; status:'approved'|'pending'|'removed'};
export type TeamEvent = {id:string; title:string; starts_at:string; ends_at:string|null; location:string; status:'scheduled'|'cancelled'|'unconfirmed'; revision:number; source_checked_at:string};
export type Availability = 'available'|'unavailable'|'maybe';
export type Response = {event_id:string; user_id:string; response:Availability; event_revision:number};
export type Squad = {event_id:string; user_id:string};
