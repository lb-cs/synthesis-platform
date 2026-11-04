/**
 * The Compare tab (UC-18): which sources can be compared, the passages retrieved from
 * each, and the citations a comparison streams with. Type-only imports, so the tab's
 * client component can use the limits and `getComparableSources` too.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ComparedSource, PassageNumber } from '@/lib/ai';
import type { CitedSource } from '@/lib/citations';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

export const MIN_COMPARED_SOURCES = 2;
export const MAX_COMPARED_SOURCES = 5;

export const MAX_TOPIC_LENGTH = 500;

// Per source: enough for a fair picture of each, few enough that five fit one prompt.
const PASSAGES_PER_SOURCE = 6;

export type ComparableSource = Pick<Source, 'id' | 'title'>;

export type ComparisonPassagesResult =
  { ok: true; sources: ComparedSource[] } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

/** Ready sources, oldest first: only those have chunks retrieval can search. */
export function getComparableSources(sources: Source[]): ComparableSource[] {
  const ready = sources.filter((source) => source.status === 'ready');
  const oldestFirst = ready.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

  return oldestFirst.map(({ id, title }) => ({ id, title }));
}

/**
 * The best-matching chunks from each source, grouped in the order `sources` gives.
 * Runs as the signed-in user, so RLS scopes it; a source with no match gets no chunks.
 */
export async function findComparisonPassages(
  supabase: Client,
  projectId: string,
  sources: ComparableSource[],
  queryEmbedding: string,
): Promise<ComparisonPassagesResult> {
  const { data, error } = await supabase.rpc('match_source_chunks', {
    project_id: projectId,
    source_ids: sources.map((source) => source.id),
    query_embedding: queryEmbedding,
    match_count_per_source: PASSAGES_PER_SOURCE,
  });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const compared = sources.map((source) => {
    const rows = data.filter((row) => row.source_id === source.id);
    const chunks = rows.map((row) => {
      return {
        id: row.id,
        sourceTitle: source.title,
        content: row.content,
        pageNumber: row.page_number,
      };
    });

    return { id: source.id, title: source.title, chunks };
  });

  return { ok: true, sources: compared };
}

/** Each `[n]` the comparison can cite, as the source and page it opens. */
export function toPassageCitations(
  sources: ComparedSource[],
  passageNumbers: PassageNumber[],
): CitedSource[] {
  const passageByChunkId = new Map(
    sources.flatMap((source) => {
      return source.chunks.map((chunk) => {
        const passage = {
          id: source.id,
          title: source.title,
          pageNumber: chunk.pageNumber,
        };

        return [chunk.id, passage] as const;
      });
    }),
  );

  return passageNumbers.flatMap(({ number, chunkId }) => {
    const passage = passageByChunkId.get(chunkId);

    return passage ? [{ number, ...passage }] : [];
  });
}
