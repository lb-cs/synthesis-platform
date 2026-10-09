'use server';

import { revalidatePath } from 'next/cache';

import { deleteSource } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { removeSourceSchema, type RemoveSourceInput } from './schema';

// Server actions are public endpoints, so check sign-in and the ids even behind the UI.
export async function removeSource(
  input: RemoveSourceInput,
): Promise<{ error?: string }> {
  const parsed = removeSourceSchema.safeParse(input);

  // A malformed id can't match a row, so it reads the same as a missing source.
  if (!parsed.success) {
    return { error: 'This source no longer exists. Refresh the page.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  const { projectId, sourceId } = parsed.data;
  const result = await deleteSource(supabase, projectId, sourceId);

  // RLS hides other users' sources, so "not allowed" lands here too.
  if (!result.ok && result.kind === 'not-found') {
    return { error: 'This source no longer exists. Refresh the page.' };
  }

  if (!result.ok && result.kind === 'database-error') {
    return { error: 'Could not remove the source. Try again.' };
  }

  // A storage-error still counts: the row is gone, so the AI can't use the source, and
  // the leftover file is unreachable. Retrying would only report "not found".
  revalidatePath(`/projects/${projectId}`, 'layout');

  return {};
}
