import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { authErrorMessage, saveAccountPassword, submitAccount, type PasswordAuth } from '../lib/attendance/password';
import { createRecoveryState } from '../lib/attendance/recovery';

const redirect='https://ivan2000w.github.io/abssa-matchday/?team=1';
function mockAuth() {
  const calls:{url:string;body:Record<string,unknown>}[]=[];
  const client=createClient('https://auth.test','public-test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      const url=String(input);
      calls.push({url,body:JSON.parse(String(init?.body||'{}'))});
      if(url.includes('/token'))return new Response(JSON.stringify({code:'invalid_credentials',msg:'Invalid login credentials'}),{status:400,headers:{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}});
      return new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}});
    }},
  });
  return {auth:client.auth,calls};
}

test('returning-user login uses password endpoint, never sends OTP or creates an account',async()=>{
  const {auth,calls}=mockAuth();
  await assert.rejects(submitAccount(auth,'login',' player@example.test ','test-password','',''),err=>authErrorMessage(err).startsWith('Email or password is incorrect.'));
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/token\?grant_type=password$/);
  assert.equal(calls[0].body.email,'player@example.test');
  assert.equal(calls[0].body.password,'test-password');
});

test('signup requires matching passwords and sends no team role or approval metadata',async()=>{
  const {auth,calls}=mockAuth();
  await assert.rejects(submitAccount(auth,'signup','player@example.test','abcdefgh','different',redirect),/do not match/);
  assert.equal(calls.length,0);
  const message=await submitAccount(auth,'signup','player@example.test','abcdefgh','abcdefgh',redirect);
  assert.match(message,/confirm your account once/);
  assert.match(calls[0].url,/\/signup\?/);
  assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),redirect);
  assert.deepEqual(calls[0].body.data,{});
});

test('first-password and forgotten-password setup recover the existing identity with a non-enumerating notice',async()=>{
  const {auth,calls}=mockAuth();
  const notice=await submitAccount(auth,'reset','player@example.test','','',redirect);
  assert.match(notice,/If an account exists/);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/recover\?/);
  assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),redirect);
  assert.equal(calls[0].body.password,undefined);
});

test('password update validates first, updates only the password, and propagates expired-session failures',async()=>{
  const updates:unknown[]=[];
  const auth={updateUser:async(attributes:unknown)=>{updates.push(attributes);return {error:null};}} as unknown as PasswordAuth;
  await assert.rejects(saveAccountPassword(auth,'short','short'),/8 characters/);
  await assert.rejects(saveAccountPassword(auth,'abcdefgh','different'),/do not match/);
  assert.equal(updates.length,0);
  await saveAccountPassword(auth,'abcdefgh','abcdefgh');
  assert.deepEqual(updates,[{password:'abcdefgh'}]);
  const expired={updateUser:async()=>({error:{message:'Session expired'}})} as unknown as PasswordAuth;
  await assert.rejects(saveAccountPassword(expired,'abcdefgh','abcdefgh'),{message:'Session expired'});
});

test('recovery survives events before React mounts, token refresh and page reload, then clears after save or logout',()=>{
  const data=new Map<string,string>();
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
  const initial=createRecoveryState(storage);
  initial.onAuthEvent('PASSWORD_RECOVERY');
  let notices=0;
  const unsubscribe=initial.subscribe(()=>notices++);
  initial.onAuthEvent('INITIAL_SESSION');
  initial.onAuthEvent('TOKEN_REFRESHED');
  initial.onAuthEvent('SIGNED_IN');
  assert.equal(initial.get(),true);
  const remounted=createRecoveryState(storage);
  assert.equal(remounted.get(),true);
  initial.finish();
  assert.equal(notices,1);
  assert.equal(createRecoveryState(storage).get(),false);
  unsubscribe();
  remounted.onAuthEvent('PASSWORD_RECOVERY');
  remounted.onAuthEvent('SIGNED_OUT');
  assert.equal(remounted.get(),false);
  assert.equal(data.size,0);
});
