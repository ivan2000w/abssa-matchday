import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CalendarDays, Check, ChevronLeft, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { attendance, type Availability, type Member, type Response, type Squad, type TeamEvent } from '@/lib/attendance/client';

const labels: Record<Availability,string> = {available:'Available',unavailable:'Unavailable',maybe:'Maybe'};
const date = (value:string) => new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'}).format(new Date(value));

export function AttendancePanel() {
  const [session,setSession] = useState<Session|null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [email,setEmail] = useState('');
  const [name,setName] = useState('');
  const [members,setMembers] = useState<Member[]>([]);
  const [events,setEvents] = useState<TeamEvent[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [responses,setResponses] = useState<Response[]>([]);
  const [squad,setSquad] = useState<Squad[]>([]);
  const [loaded,setLoaded] = useState(false);
  const [detailsReady,setDetailsReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [history,setHistory] = useState(false);
  const sequence = useRef(0);
  const detailsSequence = useRef(0);
  const currentUser = useRef<string|undefined>(undefined);
  const me = members.find(m=>m.user_id===session?.user.id);
  const coach = me?.role==='coach' && me.status==='approved';
  const event = events.find(e=>e.id===selected);
  const roster = members.filter(m=>m.status==='approved');

  const clear = useCallback(()=>{
    sequence.current++; detailsSequence.current++;
    setMembers([]);setEvents([]);setResponses([]);setSquad([]);setSelected(null);setLoaded(false);setDetailsReady(false);
  },[]);
  useEffect(()=>{
    if (!attendance) {setAuthReady(true);return;}
    const {data:{subscription}} = attendance.auth.onAuthStateChange((_event,next)=>{
      if (currentUser.current!==next?.user.id) { clear();currentUser.current=next?.user.id; }
      setSession(next);setAuthReady(true);
    });
    void attendance.auth.getSession().then(({data,error:err})=>{if(err)setError(err.message);setSession(data.session);setAuthReady(true);});
    return ()=>subscription.unsubscribe();
  },[clear]);

  const load = useCallback(async()=>{
    if (!attendance || !session) return;
    const ticket=++sequence.current;
    const {data:people,error:peopleError}=await attendance.from('team_members').select('user_id,display_name,role,status').order('display_name');
    if(ticket!==sequence.current)return;
    if(peopleError){clear();setError('Could not verify team access. Reconnect and try again.');return;}
    const list=people as Member[];
    setMembers(list);setLoaded(true);
    if(!list.some(m=>m.user_id===session.user.id&&m.status==='approved')){setEvents([]);setResponses([]);setSquad([]);setDetailsReady(false);return;}
    const {data,error:err}=await attendance.from('team_events').select('*').order('starts_at',{ascending:true}).limit(1000);
    if(ticket!==sequence.current)return;
    if(err){setError('Calendar could not be loaded. Please retry.');setEvents([]);return;}
    setEvents(data as TeamEvent[]);setError('');
  },[session,clear]);
  useEffect(()=>{
    void load();
    const refresh=()=>{if(document.visibilityState==='visible')void load();};
    const timer=setInterval(refresh,60_000);
    addEventListener('focus',refresh);addEventListener('online',refresh);
    return ()=>{clearInterval(timer);removeEventListener('focus',refresh);removeEventListener('online',refresh);};
  },[load]);
  const loadDetails=useCallback(async()=>{
    if(!attendance||!selected||me?.status!=='approved')return;
    const ticket=++detailsSequence.current;
    const results=await Promise.all([
      attendance.from('team_responses').select('event_id,user_id,response,event_revision').eq('event_id',selected),
      attendance.from('team_squad').select('event_id,user_id').eq('event_id',selected),
    ]);
    if(ticket!==detailsSequence.current)return;
    if(results.some(r=>r.error)){setResponses([]);setSquad([]);setDetailsReady(false);setError('Attendance could not be loaded. Please retry.');return;}
    setResponses(results[0].data as Response[]);setSquad(results[1].data as Squad[]);setDetailsReady(true);
  },[selected,me?.status]);
  useEffect(()=>{setDetailsReady(false);setResponses([]);setSquad([]);void loadDetails();return ()=>{detailsSequence.current++;};},[loadDetails]);
  useEffect(()=>{const tick=setInterval(()=>{if(document.visibilityState==='visible')void loadDetails();},30_000);return ()=>clearInterval(tick);},[loadDetails]);

  const mutate=async(fn:()=>PromiseLike<{error:{message:string}|null}>)=>{
    setBusy(true);setError('');setNotice('');
    try {const {error:err}=await fn();if(err)throw err;await load();await loadDetails();}
    catch(err){setError(err instanceof Error?err.message:(err as {message?:string})?.message||'Could not save. Please retry.');}
    finally{setBusy(false);}
  };
  const signIn=async(e:FormEvent)=>{
    e.preventDefault();if(!attendance)return;
    setBusy(true);setError('');setNotice('');
    const redirect=new URL(import.meta.env.BASE_URL,location.origin);redirect.searchParams.set('team','1');
    const {error:err}=await attendance.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirect.href}});
    setBusy(false);if(err)setError(err.message);else setNotice('Check your email for your secure sign-in link. New members can request team access after signing in.');
  };
  const manage=(member:Member,action:'approve'|'remove'|'promote'|'demote')=>{
    if(!attendance)return;
    if(action!=='approve'&&!window.confirm(`${action==='promote'?'Make coach':action==='demote'?'Remove coach role from':'Remove team access for'} ${member.display_name}?`))return;
    void mutate(()=>attendance!.rpc('manage_team_member',{p_user:member.user_id,p_action:action}));
  };
  const signOut=async()=>{
    if(!attendance)return;
    setBusy(true);setError('');setNotice('');
    const {error:err}=await attendance.auth.signOut({scope:'local'});
    if(err)setError(err.message);else{clear();setSession(null);}
    setBusy(false);
  };

  if(!attendance)return <section className="attendance-card"><ShieldCheck/><h1>Sanserif team space</h1><p>Private accounts and attendance are being connected. They are not available yet.</p></section>;
  if(!authReady)return <p role="status">Checking your sign-in…</p>;
  return <div className="attendance">
    <div className="attendance-title"><div><span className="eyebrow">Private · SANSERIF FC</span><h1>My team</h1></div>{session&&<button className="attendance-button" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/>Sign out</button>}</div>
    {error&&<p className="attendance-error" role="alert">{error}</p>}
    {notice&&<p className="attendance-notice" role="status">{notice}</p>}
    {!session ? <section className="attendance-card auth-card"><ShieldCheck size={32}/><h2>Your team. Your matchday.</h2><p>Sign in or create an account with your email. After coach approval, see the calendar, tell the team when you’re available and check the selected squad.</p><form onSubmit={signIn}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="attendance-button primary" disabled={busy}>{busy?'Sending…':'Email me a sign-in link'}</button></form><small>Attendance is visible to approved team members. Only coaches select the squad.</small></section>
    : !loaded ? <section className="attendance-card"><p>Loading your team…</p><button className="attendance-button" onClick={()=>void load()}>Retry</button></section>
    : !me ? <section className="attendance-card"><h2>Join Sanserif FC</h2><p>Use the name your teammates know. A coach will approve your request.</p><form onSubmit={e=>{e.preventDefault();void mutate(()=>attendance!.rpc('join_team',{p_name:name.trim()}));}}><label>Your name<input required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label><button className="attendance-button primary" disabled={busy}>Request team access</button></form></section>
    : me.status!=='approved' ? <section className="attendance-card"><h2>{me.status==='pending'?'Waiting for coach approval':'Team access removed'}</h2><p>{me.status==='pending'?'Your request is saved. Once a coach approves you, your calendar and teammates will appear here.':'Contact your coach if you need to rejoin.'}</p><button className="attendance-button" onClick={()=>void load()}><RefreshCw size={16}/>Check access</button></section>
    : <>
      <div className="attendance-welcome"><span>Hello, <strong>{me.display_name}</strong>{coach?' · Coach':''}</span><button className="attendance-button" onClick={()=>{void load();void loadDetails();}}><RefreshCw size={16}/>Refresh</button></div>
      {coach&&members.some(m=>m.status==='pending')&&<section className="attendance-card"><h2>Join requests</h2>{members.filter(m=>m.status==='pending').map(m=><div className="attendance-person" key={m.user_id}><strong>{m.display_name}</strong><div><button disabled={busy} className="attendance-button primary" onClick={()=>manage(m,'approve')}>Approve</button><button disabled={busy} className="attendance-button" onClick={()=>manage(m,'remove')}>Decline</button></div></div>)}</section>}
      {event ? <section className="attendance-card event-detail">
        <button className="attendance-button" onClick={()=>setSelected(null)}><ChevronLeft size={16}/>All events</button>
        <p className="eyebrow">SportEasy calendar · {event.status}</p><h2>{event.title}</h2><p className="event-time"><CalendarDays size={18}/>{date(event.starts_at)}</p>{event.location&&<p>{event.location}</p>}<small>Times shown in Belgium time · Calendar checked {date(event.source_checked_at)}</small>
        {Date.now()-Date.parse(event.source_checked_at)>26*60*60*1000&&<p className="attendance-notice">Calendar update overdue. Confirm this event’s time with your coach.</p>}
        {event.status==='scheduled'&&Date.parse(event.starts_at)>Date.now()&&<div className="rsvp-block"><h3>Can you attend?</h3><p>Availability is separate from squad selection.</p><div className="rsvp-options">{(Object.keys(labels) as Availability[]).map(value=><button key={value} disabled={busy||!detailsReady} aria-pressed={responses.some(r=>r.user_id===me.user_id&&r.response===value&&r.event_revision===event.revision)} onClick={()=>void mutate(()=>attendance!.rpc('set_availability',{p_event:event.id,p_response:value}))}>{labels[value]}</button>)}</div>{responses.some(r=>r.user_id===me.user_id&&r.event_revision!==event.revision)&&<p className="attendance-notice">This event changed. Please confirm your availability again.</p>}</div>}
        <h3>Team availability & squad</h3>{!detailsReady?<p role="status">Loading attendance…</p>:<><p>{responses.filter(r=>r.response==='available'&&r.event_revision===event.revision&&roster.some(m=>m.user_id===r.user_id)).length} available · {squad.length} selected</p><ul className="attendance-roster">{roster.map(m=>{const response=responses.find(r=>r.user_id===m.user_id);const isSelected=squad.some(s=>s.user_id===m.user_id);return <li className="attendance-person" key={m.user_id}><div><strong>{m.display_name}{m.user_id===me.user_id?' (you)':''}</strong><span className={`rsvp-label ${response?.response||''}`}>{response?`${labels[response.response]}${response.event_revision!==event.revision?' · Needs reconfirmation':''}`:'No response'}</span>{isSelected&&<span className="squad-tag"><Check size={14}/>Selected in squad</span>}</div>{coach&&event.status==='scheduled'&&Date.parse(event.starts_at)>Date.now()&&<button className={`attendance-button ${isSelected?'':'primary'}`} disabled={busy} onClick={()=>void mutate(()=>attendance!.rpc('select_squad',{p_event:event.id,p_user:m.user_id,p_selected:!isSelected}))}>{isSelected?'Remove from squad':'Select'}</button>}</li>;})}</ul></>}
      </section>:<><div className="match-segments"><button aria-pressed={!history} onClick={()=>setHistory(false)}>Upcoming</button><button aria-pressed={history} onClick={()=>setHistory(true)}>Past events</button></div><div className="attendance-events">{events.filter(e=>history?Date.parse(e.starts_at)<=Date.now():Date.parse(e.starts_at)>Date.now()).sort((a,b)=>history?b.starts_at.localeCompare(a.starts_at):a.starts_at.localeCompare(b.starts_at)).map(e=><button className="attendance-event" key={e.id} onClick={()=>setSelected(e.id)}><CalendarDays/><div><small>{date(e.starts_at)}</small><h2>{e.title}</h2><p>{e.location||'Venue not published'}</p><span>{e.status==='scheduled'?'View attendance & squad':e.status==='cancelled'?'Cancelled':'Awaiting calendar confirmation'}</span></div></button>)}</div>{!events.some(e=>history?Date.parse(e.starts_at)<=Date.now():Date.parse(e.starts_at)>Date.now())&&<section className="attendance-card"><h2>{history?'No past events imported':'No upcoming events imported'}</h2><p>The team calendar will appear after the coach’s SportEasy feed is connected and verified.</p></section>}</>}
      {coach&&<details className="attendance-card"><summary><Users size={18}/>Manage members & coaches</summary><p>Promote another approved member before removing your own coach role.</p>{members.filter(m=>m.status!=='pending').map(m=><div className="attendance-person" key={m.user_id}><div><strong>{m.display_name}</strong><small>{m.status} · {m.role}</small></div><div className="member-actions">{m.status==='removed'?<button disabled={busy} className="attendance-button" onClick={()=>manage(m,'approve')}>Restore access</button>:<><button disabled={busy} className="attendance-button" onClick={()=>manage(m,m.role==='coach'?'demote':'promote')}>{m.role==='coach'?'Remove coach role':'Make coach'}</button><button disabled={busy} className="attendance-button" onClick={()=>manage(m,'remove')}>Remove member</button></>}</div></div>)}</details>}
    </>}
  </div>;
}
