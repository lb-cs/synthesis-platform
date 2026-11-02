'use server';

import { revalidatePath } from 'next/cache';

import { getLinkTitle } from '@/lib/link-url';
import { createLinkSource, deleteSource } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import {
  addLinkSchema,
  removeSourceSchema,
  sourceIdsSchema,
  type AddLinkInput,
  type RemoveSourceInput,
  type SourceIdsInput,
} from './schema';

/** UC-12: adds a web link as a source. It starts `pending` and the worker takes it from there. */
export async function addLinkSource(input: AddLinkInput): Promise<{ error?: string }> {
  const parsed = addLinkSchema.safeParse(input);

  if (!parsed.success) {
    const urlIssue = parsed.error.issues.find((issue) => issue.path[0] === 'url');

    return {
      error: urlIssue?.message ?? 'This project no longer exists. Refresh the page.',
    };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  const { projectId, url } = parsed.data;
  const result = await createLinkSource(supabase, projectId, {
    title: getLinkTitle(url),
    url,
  });

  // RLS rejects a project that is not theirs, so "not allowed" lands here too.
  if (!result.ok) {
    return { error: 'Could not add the link. Try again.' };
  }

  revalidatePath(`/projects/${projectId}`, 'layout');

  return {};
}

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

export async function retryFailedSource(
  input: SourceIdsInput,
): Promise<{ error?: string }> {
  const parsed = sourceIdsSchema.safeParse(input);

  if (!parsed.success) {
    return { error: 'This source cannot be retried. Refresh the page.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  const { projectId, sourceId } = parsed.data;
  const { data, error } = await supabase.rpc('retry_failed_source', {
    p_project_id: projectId,
    p_source_id: sourceId,
  });

  if (error) {
    return { error: 'Could not retry this source. Try again.' };
  }

  if (!data) {
    return { error: 'This source is no longer failed. Refresh the page.' };
  }

  revalidatePath(`/projects/${projectId}`, 'layout');

  return {};
}
