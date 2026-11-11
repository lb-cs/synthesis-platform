/**
 * Answers a question by retrieval (UC-16): the route embeds the question, this finds the
 * closest chunks across the project's ready sources, and only those go to the model,
 * numbered as passages. The answer cites passage numbers; `citations` rows keep them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { PassageNumber, RetrievedChunk } from '@/lib/ai';
import type { CitedSource } from '@/lib/citations';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

// Enough to cover a question that spans a few sources, small enough to keep each
// question cheap however many sources the project has.
const CHAT_PASSAGE_COUNT = 8;

/** A retrieved chunk plus the source it came from, so a citation can open it. */
export type ChatPassage = RetrievedChunk & { sourceId: string; sourceUrl: string | null };

export type ChatPassagesResult =
  { ok: true; passages: ChatPassage[] } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

/**
 * The sources chat can draw on, oldest first: files and links that haven't failed. Only
 * the `ready` ones are searchable yet; the rest are still processing.
 */
export function getChatSources(sources: Source[]): Source[] {
  const usable = sources.filter((source) => source.status !== 'failed');

  return usable.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The chunks closest to the question, best first. `sources` gives their titles; a chunk
 * whose source isn't in it (removed mid-request) is dropped. Runs as the signed-in user,
 * so RLS scopes it, and `match_document_chunks` searches only ready sources.
 */
export async function findChatPassages(
  supabase: Client,
  projectId: string,
  sources: Source[],
  queryEmbedding: string,
): Promise<ChatPassagesResult> {
  const { data, error } = await supabase.rpc('match_document_chunks', {
    project_id: projectId,
    query_embedding: queryEmbedding,
    match_count: CHAT_PASSAGE_COUNT,
  });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));

  const passages = data.flatMap((row) => {
    const source = sourceById.get(row.source_id);

    if (source === undefined) {
      return [];
    }

    const passage: ChatPassage = {
      id: row.id,
      sourceId: row.source_id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      content: row.content,
      pageNumber: row.page_number,
    };

    return [passage];
  });

  return { ok: true, passages };
}

/** Each `[n]` the answer can cite, as the source and page it opens. */
export function toChatCitations(
  passages: ChatPassage[],
  passageNumbers: PassageNumber[],
): CitedSource[] {
  const passageById = new Map(passages.map((passage) => [passage.id, passage]));

  return passageNumbers.flatMap(({ number, chunkId }) => {
    const passage = passageById.get(chunkId);

    if (!passage) {
      return [];
    }

    const citation: CitedSource = {
      number,
      id: passage.sourceId,
      title: passage.sourceTitle,
      pageNumber: passage.pageNumber,
      passage: passage.content,
      url: passage.sourceUrl,
    };

    return [citation];
  });
}
