'use server';

import { revalidatePath } from 'next/cache';

import { projectIdSchema } from '@/app/api/projects/schema';
import { clearChat } from '@/lib/chat';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

// Server actions are public endpoints, so check sign-in and the id even behind the UI.
/** Deletes the project's conversation so the next question starts fresh. */
export async function startNewChat(projectId: string): Promise<{ error?: string }> {
  const parsed = projectIdSchema.safeParse(projectId);

  if (!parsed.success) {
    return { error: 'This project no longer exists. Refresh the page.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  // RLS limits the delete to the user's own projects; someone else's deletes nothing.
  const result = await clearChat(supabase, parsed.data);

  if (!result.ok) {
    return { error: 'Could not start a new chat. Try again.' };
  }

  revalidatePath(`/projects/${parsed.data}`);

  return {};
}
