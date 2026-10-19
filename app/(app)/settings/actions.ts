'use server';

import { revalidatePath } from 'next/cache';

import { deleteAccount } from '@/lib/account';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

// Server actions are public endpoints, so check sign-in even behind the UI. The id comes
// from the verified session, never from the caller.
export async function removeAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
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
