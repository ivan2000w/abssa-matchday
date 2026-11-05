import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { attendance } from '@/lib/attendance/client';
import { authErrorMessage, MIN_PASSWORD_LENGTH, saveAccountPassword, submitAccount, type AccountMode } from '@/lib/attendance/password';

function teamRedirect() {
  const url=new URL(import.meta.env.BASE_URL,location.origin);
  url.searchParams.set('team','1');
  return url.href;
}

function PasswordInput({value,onChange,label='Password',fresh=false}:{value:string;onChange:(value:string)=>void;label?:string;fresh?:boolean}) {
  const [visible,setVisible]=useState(false);
  return <label>{label}<span className="password-input"><input aria-label={label} type={visible?'text':'password'} autoComplete={fresh?'new-password':'current-password'} required minLength={fresh?MIN_PASSWORD_LENGTH:undefined} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></span></label>;
}

export function AccountAccess() {
  const [mode,setMode]=useState<AccountMode>('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const changeMode=(next:AccountMode)=>{setMode(next);setPassword('');setConfirmation('');setError('');setNotice('');};
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!attendance||busy)return;
    setBusy(true);setError('');setNotice('');
    try {setNotice(await submitAccount(attendance.auth,mode,email,password,confirmation,teamRedirect()));setPassword('');setConfirmation('');}
    catch(err){setError(authErrorMessage(err));}
    finally{setBusy(false);}
  };
  return <section className="attendance-card auth-card">
    <LockKeyhole size={30}/>
    <h2>{mode==='login'?'Welcome back':mode==='signup'?'Create your account':'Set or reset your password'}</h2>
    <p>{mode==='login'?'Log in with your email and password.':mode==='signup'?'Verify your email once, then use your password to log in. A coach approves access to the team.':'Already used an email sign-in link? Use this to choose your first password, or replace a forgotten one.'}</p>
    {mode!=='reset'&&<div className="account-tabs" aria-label="Account options"><button type="button" aria-pressed={mode==='login'} disabled={busy} onClick={()=>changeMode('login')}>Log in</button><button type="button" aria-pressed={mode==='signup'} disabled={busy} onClick={()=>changeMode('signup')}>Create account</button></div>}
    {error&&<p className="attendance-error" role="alert">{error}</p>}
    {notice&&<p className="attendance-notice" role="status">{notice}</p>}
    <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {mode!=='reset'&&<PasswordInput value={password} onChange={setPassword} fresh={mode==='signup'}/>}
      {mode==='signup'&&<><PasswordInput label="Confirm password" value={confirmation} onChange={setConfirmation} fresh/><small>Use at least 8 characters.</small></>}
      <button className="attendance-button primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':mode==='signup'?'Create account':'Email password setup link'}</button>
    </form>
    {mode==='login'?<div className="account-links"><button type="button" disabled={busy} onClick={()=>changeMode('reset')}>Forgot password?</button><button type="button" disabled={busy} onClick={()=>changeMode('reset')}>Used email links before? Set your first password</button></div>:<button type="button" className="attendance-button" disabled={busy} onClick={()=>changeMode('login')}>Back to log in</button>}
    <small className="account-privacy">Only approved teammates can see attendance. Only coaches select the squad.</small>
  </section>;
}

export function AccountPassword({onDone,onCancel}:{onDone:()=>void;onCancel:()=>void}) {
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!attendance||busy)return;
    setBusy(true);setError('');
    try {await saveAccountPassword(attendance.auth,password,confirmation);setPassword('');setConfirmation('');onDone();}
    catch(err){setError(authErrorMessage(err));}
    finally{setBusy(false);}
  };
  return <section className="attendance-card auth-card"><LockKeyhole size={30}/><h2>Choose your password</h2><p>Next time, just use your email and password. Your existing team account and access stay the same.</p>{error&&<p className="attendance-error" role="alert">{error}</p>}<form onSubmit={submit}><PasswordInput label="New password" value={password} onChange={setPassword} fresh/><PasswordInput label="Confirm password" value={confirmation} onChange={setConfirmation} fresh/><small>Use at least 8 characters.</small><button className="attendance-button primary" disabled={busy}>{busy?'Saving…':'Save password'}</button><button className="attendance-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></form></section>;
}
