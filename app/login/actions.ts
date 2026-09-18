'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { codeSchema, emailSchema, type CodeInput, type EmailInput } from './schema';

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

export async function verifyCode(input: CodeInput): Promise<{ error: string }> {
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}
