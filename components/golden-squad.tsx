import {useEffect,useState} from 'react';
import {ExternalLink,Link2,RefreshCw,Trophy} from 'lucide-react';
import {attendance} from '@/lib/attendance/client';
import {GOLDEN_BASE,goldenCardUrl,type GoldenPlayer,type GoldenLink} from '@/lib/attendance/golden';
import {PlayerAvatar} from './player-photo';

export function GoldenProfileLink({players,links,userId,uploadedPhoto,onSaved,onView}:{players:GoldenPlayer[];links:GoldenLink[];userId:string;uploadedPhoto:boolean;onSaved:()=>Promise<void>;onView:(id:string)=>void}) {
  const linkedId=links.find(link=>link.user_id===userId)?.player_id??'';
  const [choice,setChoice]=useState(linkedId);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>setChoice(linkedId),[linkedId]);
  const player=players.find(p=>p.id===choice);
  const linked=players.find(p=>p.id===linkedId);
  const save=async(id:string|null)=>{
    if(!attendance)return;
    setBusy(true);setError('');setNotice('');
    try {const {error:err}=await attendance.rpc('link_golden_player',{p_player:id});if(err)throw err;await onSaved();setNotice(id?'Player card connected.':'Player card disconnected.');}
    catch(err){setError(err instanceof Error?err.message:(err as {message?:string})?.message||'Could not connect this card.');}
    finally{setBusy(false);}
  };
  return <details className="attendance-card golden-profile-link"><summary><Link2 size={18}/>My Golden Squad card{linked&&<span className="golden-linked-label">Connected</span>}</summary>
    <p>Choose your own player profile once. Its picture will appear beside your attendance, unless you upload a different photo.</p>
    <label>Your Golden Squad player<select value={choice} disabled={busy} onChange={e=>{setChoice(e.target.value);setNotice('');setError('');}}><option value="">Choose your name</option>{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.position}</option>)}</select></label>
    {player&&<div className="golden-link-preview"><PlayerAvatar name={player.display_name} photo={player.photo_url??undefined} large/><div><strong>{player.display_name}</strong><small>{player.position} · Golden Squad</small>{uploadedPhoto&&<small>Your uploaded photo takes priority.</small>}</div></div>}
    {linkedId&&!linked&&<p className="attendance-notice">Your linked card is no longer in the source roster. Choose a new profile or disconnect it.</p>}
    <div className="photo-actions"><button className="attendance-button primary" disabled={busy||!player||choice===linkedId} onClick={()=>void save(choice)}>{busy?'Saving…':'This is me — connect'}</button>{linked&&<button className="attendance-button" onClick={()=>onView(linked.id)}>View my card</button>}{linkedId&&<button className="attendance-button" disabled={busy} onClick={()=>void save(null)}>Disconnect</button>}</div>
    {error&&<p className="attendance-error" role="alert">{error}</p>}{notice&&<p className="attendance-notice" role="status">{notice}</p>}
    {!players.length&&<p className="attendance-notice">The player directory is unavailable. Refresh to retry.</p>}
  </details>;
}
export function GoldenSquad({playerId}:{playerId:string|null}) {
  const [page,setPage]=useState(playerId?goldenCardUrl(playerId):`${GOLDEN_BASE}/classement`);
  const [version,setVersion]=useState(0);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setPage(playerId?goldenCardUrl(playerId):`${GOLDEN_BASE}/classement`);},[playerId]);
  useEffect(()=>setLoaded(false),[page,version]);
  return <section className="golden-squad"><div className="golden-heading"><div><span className="eyebrow">Club player ratings</span><h2><Trophy size={20}/>Golden Squad</h2></div><a className="attendance-button" href={page} target="_blank" rel="noopener noreferrer">Open app <ExternalLink size={14}/></a></div>
    <p className="golden-description">Live player cards, pictures and rankings, maintained in Golden Squad. Use its menu for the season and monthly standings.</p>
    <div className="golden-toolbar"><button className="attendance-button" onClick={()=>setPage(`${GOLDEN_BASE}/classement`)}>Rankings</button>{playerId&&<button className="attendance-button" onClick={()=>setPage(goldenCardUrl(playerId))}>My card</button>}<button className="attendance-button" onClick={()=>setVersion(v=>v+1)}><RefreshCw size={14}/>Reload</button></div>
    {!loaded&&<p role="status">Opening Golden Squad…</p>}
    <iframe key={`${page}-${version}`} className="golden-frame" src={page} title="Golden Squad — Sanserif player cards and rankings" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" onLoad={()=>setLoaded(true)}/>
    <small>If the embedded app cannot load, use Open app above. Golden Squad’s name selector does not change your ABSSA account or team permissions.</small>
  </section>;
}
