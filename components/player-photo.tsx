import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { attendance } from '@/lib/attendance/client';
import { prepareProfilePhoto } from '@/lib/attendance/photo';

export function PlayerAvatar({name,photo,large=false}:{name:string;photo?:string;large?:boolean}) {
  const [failed,setFailed]=useState<string|null>(null);
  const initials=name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  return <span className={`player-avatar ${large?'player-avatar-large':''}`}>
    {photo&&photo!==failed?<img referrerPolicy="no-referrer" src={photo} alt={`${name}'s profile photo`} onError={()=>setFailed(photo)}/>:<span aria-label={`${name} · no profile photo`}>{initials}</span>}
  </span>;
}
export function ProfilePhoto({name,photo,fallbackPhoto,onSaved}:{name:string;photo?:string;fallbackPhoto?:string;onSaved:()=>Promise<void>}) {
  const [draft,setDraft]=useState<string|null|undefined>(undefined);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const shown=draft===undefined?(photo??fallbackPhoto):(draft??fallbackPhoto);
  const choose=async(file:File)=>{
    setBusy(true);setError('');setNotice('');
    try {setDraft(await prepareProfilePhoto(file));}catch(err){setError(err instanceof Error?err.message:'Could not open this photo.');}
    finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  };
  const save=async()=>{
    if(!attendance||draft===undefined)return;
    setBusy(true);setError('');setNotice('');
    try {
      const {error:err}=await attendance.rpc('set_profile_photo',{p_photo:draft});
      if(err)throw err;
      await onSaved();setDraft(undefined);setNotice(draft===null?(fallbackPhoto?'Uploaded photo removed. Using your Golden Squad picture.':'Profile photo removed.'):'Profile photo saved.');
    }catch(err){setError(err instanceof Error?err.message:(err as {message?:string})?.message||'Could not save your photo.');}
    finally{setBusy(false);}
  };
  return <details className="attendance-card profile-photo-editor"><summary><Camera size={18}/>My profile photo</summary>
    <p>Your photo appears beside your availability and squad status. Only approved teammates can see it.</p>
    {!photo&&fallbackPhoto&&draft===undefined&&<small>Using your connected Golden Squad picture. An uploaded photo will replace it here.</small>}
    <div className="photo-edit-layout"><PlayerAvatar name={name} photo={shown} large/><div>
      <label className="photo-picker">Choose a photo<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void choose(file);}}/></label>
      <small>JPG, PNG or WebP · up to 8 MB. Preview uses a centred square crop.</small>
    </div></div>
    {error&&<p role="alert" className="attendance-error">{error}</p>}{notice&&<p role="status" className="attendance-notice">{notice}</p>}
    <div className="photo-actions">{draft!==undefined&&<><button className="attendance-button primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':draft===null?'Save removal':'Save photo'}</button><button className="attendance-button" disabled={busy} onClick={()=>{setDraft(undefined);setError('');}}>Cancel</button></>}{(draft===undefined?photo:draft)&&<button className="attendance-button" disabled={busy} onClick={()=>{setDraft(null);setNotice('');setError('');}}>Remove uploaded photo</button>}</div>
  </details>;
}
