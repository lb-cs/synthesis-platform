/**
 * The Compare tab (UC-18): which sources can be compared and the passages retrieved
 * from each. Type-only imports (plus pure `lib/passages`), so the tab's client component
 * can use the limits and `getComparableSources` too.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SourcePassages } from '@/lib/ai';
import { getReadySources, groupPassages, type PassageSource } from '@/lib/passages';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

export const MIN_COMPARED_SOURCES = 2;
export const MAX_COMPARED_SOURCES = 5;

export const MAX_TOPIC_LENGTH = 500;

// Per source: enough for a fair picture of each, few enough that five fit one prompt.
const PASSAGES_PER_SOURCE = 6;

export type ComparableSource = PassageSource;

export type ComparisonPassagesResult =
  { ok: true; sources: SourcePassages[] } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

/** Ready sources, oldest first: only those have chunks retrieval can search. */
export function getComparableSources(sources: Source[]): ComparableSource[] {
  return getReadySources(sources);
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

  return { ok: true, sources: groupPassages(sources, data) };
}
