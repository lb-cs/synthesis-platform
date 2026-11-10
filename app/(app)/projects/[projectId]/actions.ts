'use server';

import { revalidatePath } from 'next/cache';

import { projectIdSchema } from '@/app/api/projects/schema';
import {
  CHAT_PAGE_SIZE,
  clearChat,
  listChatMessagePage,
  toChatUIMessages,
} from '@/lib/chat';
import type { ChatUIMessage } from '@/lib/citations';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

export type EarlierMessagesResult =
  | { ok: true; messages: ChatUIMessage[]; hasEarlier: boolean }
  | { ok: false; error: string };

/** The page of messages before `beforeId`, for "Load earlier messages". */
export async function loadEarlierMessages(
  projectId: string,
  beforeId: string,
): Promise<EarlierMessagesResult> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  const parsedBeforeId = projectIdSchema.safeParse(beforeId);

  if (!parsedProjectId.success || !parsedBeforeId.success) {
    return { ok: false, error: 'Could not load earlier messages. Refresh the page.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { ok: false, error: 'Your session expired. Sign in again.' };
  }

  // RLS scopes the read; another user's project reads as not found.
  const pageResult = await listChatMessagePage(supabase, parsedProjectId.data, {
    limit: CHAT_PAGE_SIZE,
    beforeId: parsedBeforeId.data,
  });

  if (!pageResult.ok && pageResult.kind === 'not-found') {
    return {
      ok: false,
      error: 'This chat changed since you opened it. Refresh the page.',
    };
  }

  if (!pageResult.ok) {
    return { ok: false, error: 'Could not load earlier messages. Try again.' };
  }

  const uiMessagesResult = await toChatUIMessages(supabase, pageResult.messages);

  if (!uiMessagesResult.ok) {
    return { ok: false, error: 'Could not load earlier messages. Try again.' };
  }

  return {
    ok: true,
    messages: uiMessagesResult.messages,
    hasEarlier: pageResult.hasEarlier,
  };
}

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
