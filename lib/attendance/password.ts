import type { SupabaseClient } from '@supabase/supabase-js';

export type AccountMode = 'login'|'signup'|'reset';
export type PasswordAuth = Pick<SupabaseClient['auth'], 'signInWithPassword'|'signUp'|'resetPasswordForEmail'|'updateUser'>;
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password:string, confirmation:string) {
  if(password.length<MIN_PASSWORD_LENGTH)throw new Error('Use at least 8 characters for your password.');
  if(password!==confirmation)throw new Error('The passwords do not match.');
}

export function authErrorMessage(error:unknown) {
  const code=(error as {code?:string})?.code;
  if(code==='invalid_credentials')return 'Email or password is incorrect. If you previously used email links, choose “Set your first password” below.';
  if(code==='email_not_confirmed')return 'Please confirm your email first using the message sent when you registered.';
  if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return 'Too many attempts. Please wait a few minutes and try again.';
  return (error as {message?:string})?.message || 'Could not connect. Please try again.';
}

export async function submitAccount(auth:PasswordAuth, mode:AccountMode, email:string, password:string, confirmation:string, redirect:string) {
  if(mode==='reset') {
    const {error}=await auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect});
    if(error)throw error;
    return 'If an account exists for this email, a password setup/reset link is on its way. Open it to choose your password. You only need this email once.';
  }
  if(mode==='signup') {
    validateNewPassword(password,confirmation);
    const {error}=await auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect}});
    if(error)throw error;
    return 'Check your email to confirm your account once. After that, log in with your email and password. Already registered? Use Log in or reset your password.';
  }
  const {error}=await auth.signInWithPassword({email:email.trim(),password});
  if(error)throw error;
  return '';
}

export async function saveAccountPassword(auth:PasswordAuth,password:string,confirmation:string) {
  validateNewPassword(password,confirmation);
  const {error}=await auth.updateUser({password});
  if(error)throw error;
}
