/**
 * The project's one conversation, in `public.chat_messages`. Runs as the signed-in user,
 * so RLS scopes every read and write to their projects.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChatUIMessage, CitedSource } from '@/lib/citations';
import type { Database, Tables } from '@/lib/supabase/database.types';

// Mirror the check constraints on public.chat_messages.role and .status.
export type ChatRole = 'user' | 'assistant';
export type ChatMessageStatus = 'streaming' | 'complete' | 'failed';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  createdAt: string;
};

export type CreateChatMessageInput = Pick<ChatMessage, 'role' | 'content' | 'status'>;

export type ChatMessageListResult =
  { ok: true; messages: ChatMessage[] } | { ok: false; kind: 'database-error' };

export type ChatMessageResult =
  { ok: true; message: ChatMessage } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

type ChatMessageRow = Pick<
  Tables<'chat_messages'>,
  'id' | 'role' | 'content' | 'status' | 'created_at'
>;

const CHAT_MESSAGE_COLUMNS = 'id, role, content, status, created_at';

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    status: row.status as ChatMessageStatus,
    createdAt: row.created_at,
  };
}

/** The latest `limit` messages, oldest first — ready to show or to send to the model. */
export async function listRecentChatMessages(
  supabase: Client,
  projectId: string,
  limit: number,
): Promise<ChatMessageListResult> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(CHAT_MESSAGE_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const newestFirst = data.map(toChatMessage);

  return { ok: true, messages: newestFirst.toReversed() };
}

export async function createChatMessage(
  supabase: Client,
  projectId: string,
  input: CreateChatMessageInput,
): Promise<ChatMessageResult> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ project_id: projectId, ...input })
    .select(CHAT_MESSAGE_COLUMNS)
    .single();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, message: toChatMessage(data) };
}

/** A saved message in the shape `useChat` renders. Citations use today's source numbers. */
export function toChatUIMessage(
  message: ChatMessage,
  sources: CitedSource[],
): ChatUIMessage {
  return {
    id: message.id,
    role: message.role,
    metadata: { sources },
    parts: [{ type: 'text', text: message.content }],
  };
}
