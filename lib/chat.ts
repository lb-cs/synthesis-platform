/**
 * The project's one conversation, in `public.chat_messages`, and the `public.citations`
 * its answers save. Runs as the signed-in user, so RLS scopes every read and write to
 * their projects.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { PassageNumber } from '@/lib/ai';
import { getCitedNumbers, type ChatUIMessage, type CitedSource } from '@/lib/citations';
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

export type SaveResult = { ok: true } | { ok: false; kind: 'database-error' };

export type MessageCitationsResult =
  | { ok: true; citationsByMessage: Map<string, CitedSource[]> }
  | { ok: false; kind: 'database-error' };

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

// How many messages the panel shows on load, and how many each "Load earlier" adds.
export const CHAT_PAGE_SIZE = 50;

export type ChatMessagePageResult =
  | { ok: true; messages: ChatMessage[]; hasEarlier: boolean }
  | { ok: false; kind: 'not-found' | 'database-error' };

/**
 * One page of the conversation, oldest first: the latest `limit` messages, or the
 * `limit` before the message `beforeId`. `hasEarlier` says whether older ones remain.
 */
export async function listChatMessagePage(
  supabase: Client,
  projectId: string,
  { limit, beforeId }: { limit: number; beforeId?: string },
): Promise<ChatMessagePageResult> {
  let query = supabase
    .from('chat_messages')
    .select(CHAT_MESSAGE_COLUMNS)
    .eq('project_id', projectId);

  if (beforeId) {
    const { data: cursor, error } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('project_id', projectId)
      .eq('id', beforeId)
      .maybeSingle();

    if (error) {
      return { ok: false, kind: 'database-error' };
    }

    // Gone: the chat was cleared since the page loaded, maybe in another tab.
    if (!cursor) {
      return { ok: false, kind: 'not-found' };
    }

    // Strictly before the cursor in (created_at, id) order, so no row repeats.
    const createdAt = `"${cursor.created_at}"`;
    const id = `"${beforeId}"`;

    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
    );
  }

  // One extra row says whether there is another page, without a count query.
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const hasEarlier = data.length > limit;
  const newestFirst = data.slice(0, limit).map(toChatMessage);

  return { ok: true, messages: newestFirst.toReversed(), hasEarlier };
}

/**
 * A retry re-sends the question whose answer failed, and that question is already saved.
 * Spots it so the route doesn't save it twice or show it to the model twice. `earlier` is
 * the conversation before that question (and before its failed partial answer, if any).
 */
export function splitRetry(
  messages: ChatMessage[],
  question: string,
): { isRetry: boolean; earlier: ChatMessage[] } {
  const last = messages.at(-1);
  const hasFailedAnswer = last?.role === 'assistant' && last.status === 'failed';
  const questionIndex = messages.length - (hasFailedAnswer ? 2 : 1);
  const asked = messages[questionIndex];

  if (asked?.role !== 'user' || asked.content !== question) {
    return { isRetry: false, earlier: messages };
  }

  return { isRetry: true, earlier: messages.slice(0, questionIndex) };
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

/**
 * Saves a row for each passage the answer cites, so its `[n]` still opens the right
 * source and page after a reload. Passages it was sent but never cited aren't saved.
 */
export async function createCitations(
  supabase: Client,
  messageId: string,
  answer: string,
  passageNumbers: PassageNumber[],
): Promise<SaveResult> {
  const citedNumbers = getCitedNumbers(answer);
  const cited = passageNumbers.filter(({ number }) => citedNumbers.has(number));

  if (cited.length === 0) {
    return { ok: true };
  }

  const rows = cited.map(({ number, chunkId }) => {
    return { message_id: messageId, chunk_id: chunkId, number };
  });
  const { error } = await supabase.from('citations').insert(rows);

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true };
}

/**
 * The saved citations of each message, as the source and page each `[n]` opens. A
 * message with none (a question, or an answer that cited nothing) has no entry.
 */
export async function listMessageCitations(
  supabase: Client,
  messageIds: string[],
): Promise<MessageCitationsResult> {
  const citationsByMessage = new Map<string, CitedSource[]>();

  if (messageIds.length === 0) {
    return { ok: true, citationsByMessage };
  }

  const { data, error } = await supabase
    .from('citations')
    .select(
      'message_id, number, document_chunks(page_number, content, sources(id, title, url))',
    )
    .in('message_id', messageIds)
    .order('number');

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  data.forEach((row) => {
    const chunk = row.document_chunks;
    const citation: CitedSource = {
      number: row.number,
      id: chunk.sources.id,
      title: chunk.sources.title,
      pageNumber: chunk.page_number,
      passage: chunk.content,
      url: chunk.sources.url,
    };
    const citations = citationsByMessage.get(row.message_id) ?? [];

    citationsByMessage.set(row.message_id, [...citations, citation]);
  });

  return { ok: true, citationsByMessage };
}

export type ClearChatResult = { ok: true } | { ok: false; kind: 'database-error' };

/**
 * Starts the project's chat over: deletes every message, and their citations cascade.
 * There is no archive, so this can't be undone. RLS limits it to the user's projects.
 */
export async function clearChat(
  supabase: Client,
  projectId: string,
): Promise<ClearChatResult> {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('project_id', projectId);

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true };
}

export type ChatUIMessagesResult =
  { ok: true; messages: ChatUIMessage[] } | { ok: false; kind: 'database-error' };

/** Saved messages, with their citations loaded, ready to hand to `useChat`. */
export async function toChatUIMessages(
  supabase: Client,
  messages: ChatMessage[],
): Promise<ChatUIMessagesResult> {
  const messageIds = messages.map((message) => message.id);
  const citationsResult = await listMessageCitations(supabase, messageIds);

  if (!citationsResult.ok) {
    return { ok: false, kind: 'database-error' };
  }

  const { citationsByMessage } = citationsResult;
  const uiMessages = messages.map((message) => {
    const citations = citationsByMessage.get(message.id) ?? [];

    return toChatUIMessage(message, citations);
  });

  return { ok: true, messages: uiMessages };
}

/** A saved message in the shape `useChat` renders, with the citations its `[n]` open. */
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
