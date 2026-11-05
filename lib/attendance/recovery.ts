// Register before React mounts: Supabase may consume a recovery link while the
// lazy team panel is still loading. Persist only this UI flag, never passwords.
export function createRecoveryState(storage?: Pick<Storage, 'getItem'|'setItem'|'removeItem'>) {
  const key = 'sanserif-password-recovery';
  let active = false;
  try { active = storage?.getItem(key) === '1'; } catch { /* Storage can be disabled. */ }
  const listeners = new Set<()=>void>();
  const set = (value:boolean) => {
    active = value;
    try { if(value) storage?.setItem(key,'1'); else storage?.removeItem(key); } catch { /* In-memory fallback. */ }
    listeners.forEach(listener=>listener());
  };
  return {
    get:()=>active,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
    finish:()=>set(false),
    onAuthEvent:(event:string)=>{
      if(event==='PASSWORD_RECOVERY')set(true);
      // SIGNED_IN can also fire when an existing session regains focus.
      // Keep recovery open until the user explicitly finishes or signs out.
      else if(event==='SIGNED_OUT')set(false);
    },
  };
}
