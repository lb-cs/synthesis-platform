'use server';

import { revalidatePath } from 'next/cache';

import {
  confirmEmailChange,
  deleteAccount,
  requestEmailChange,
  resendEmailChangeCode,
  type EmailChangeErrorKind,
} from '@/lib/account';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import {
  codeSchema,
  emailSchema,
  type CodeInput,
  type EmailInput,
} from '@/app/login/schema';

const SESSION_EXPIRED = 'Your session expired. Sign in again.';

const EMAIL_CHANGE_ERRORS: Record<EmailChangeErrorKind, string> = {
  'email-taken': 'That email already belongs to another account.',
  'rate-limited': 'Too many emails sent. Wait a few minutes and try again.',
  'auth-error': 'Could not send a code. Check the address and try again.',
};

// Server actions are public endpoints, so check sign-in and re-validate even behind the
// UI. The user id comes from the verified session, never from the caller.

export async function sendEmailChangeCode(
  input: EmailInput,
): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(input);

  if (!parsed.success) {
    return { error: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: SESSION_EXPIRED };
  }

  if (parsed.data.email.toLowerCase() === supabaseUser.email?.toLowerCase()) {
    return { error: 'That is already your email.' };
  }

  const result = await requestEmailChange(supabase, parsed.data.email);

  if (!result.ok) {
    return { error: EMAIL_CHANGE_ERRORS[result.kind] };
  }

  return {};
}

export async function resendEmailChange(input: EmailInput): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(input);

  if (!parsed.success) {
    return { error: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: SESSION_EXPIRED };
  }

  const result = await resendEmailChangeCode(supabase, parsed.data.email);

  if (!result.ok) {
    return { error: EMAIL_CHANGE_ERRORS[result.kind] };
  }

  return {};
}

export async function verifyEmailChange(input: CodeInput): Promise<{ error?: string }> {
  const parsed = codeSchema.safeParse(input);

  if (!parsed.success) {
    return { error: 'Enter the 6-digit code.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: SESSION_EXPIRED };
  }

  const result = await confirmEmailChange(supabase, parsed.data.email, parsed.data.token);

  if (!result.ok) {
    return { error: 'That code is wrong or has expired.' };
  }

  // The sidebar's user menu shows the email too.
  revalidatePath('/', 'layout');

  return {};
}

export async function removeAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: SESSION_EXPIRED };
  }

  const admin = createAdminClient();

  if (!admin) {
    return { error: 'Account deletion is not set up on this server.' };
  }

  const result = await deleteAccount(admin, supabaseUser.sub);

  if (!result.ok && result.kind === 'storage-error') {
    return { error: 'Could not remove your files. Nothing was deleted. Try again.' };
  }

  if (!result.ok) {
    return {
      error: 'Your files were removed, but the account was not. Try again to finish.',
    };
  }

  // The user is gone, so this only clears the leftover session cookies.
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');

  return {};
}
