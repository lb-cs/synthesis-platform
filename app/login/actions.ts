'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import {
  codeSchema,
  emailSchema,
  GOOGLE_SIGN_IN_ERROR,
  type CodeInput,
  type EmailInput,
} from './schema';

// Server actions are public endpoints, so re-validate even though the form already did.

export async function sendCode(input: EmailInput): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email });
  if (error) {
    return { error: 'Could not send a code. Check the address and try again.' };
  }

  return {};
}

export async function verifyCode(input: CodeInput): Promise<{ error?: string }> {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Enter the 6-digit code.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ ...parsed.data, type: 'email' });
  if (error) {
    return { error: 'That code is wrong or has expired.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// Returns Google's consent URL for the browser to open. Not a redirect(): leaving the
// site from inside an action rejects the caller's promise, which looks like a failure.
// signInWithOAuth stores the PKCE verifier in a cookie; /auth/callback needs it to finish.
export async function signInWithGoogle(): Promise<{ url: string } | { error: string }> {
  const headerStore = await headers();
  const origin = headerStore.get('origin');
  if (!origin) {
    return { error: GOOGLE_SIGN_IN_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) {
    return { error: GOOGLE_SIGN_IN_ERROR };
  }

  return { url: data.url };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}
