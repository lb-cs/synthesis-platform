/**
 * The Summaries page (UC-17): which sources can be summarized, and the sample of
 * passages each chosen source contributes. Type-only imports (plus pure `lib/passages`),
 * so the page and the route apply the same limits.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SourcePassages } from '@/lib/ai';
import { getReadySources, groupPassages, type PassageSource } from '@/lib/passages';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

export const MIN_SUMMARIZED_SOURCES = 1;
export const MAX_SUMMARIZED_SOURCES = 5;

// Deeper than Themes: a summary should cover a source, not just touch it. At the
// maximum that is 60 passages, about 15k tokens.
export const PASSAGES_PER_SOURCE = 12;

export type SummarizableSource = PassageSource;

export type SummaryPassagesResult =
  | { ok: true; sources: SourcePassages[] }
  | { ok: false; kind: 'database-error' }
  | { ok: false; kind: 'no-text'; titles: string[] };

type Client = SupabaseClient<Database>;

/** Ready sources, oldest first: only those have chunks to sample. */
export function getSummarizableSources(sources: Source[]): SummarizableSource[] {
  return getReadySources(sources);
}

/** One sentence naming the sources that have no text, for an error response or alert. */
export function getNoTextMessage(titles: string[]): string {
  const names = titles.map((title) => `"${title}"`).join(', ');

  if (titles.length === 1) {
    return `${names} has no text to summarize. Remove it from your selection and try again.`;
  }

  return `These sources have no text to summarize: ${names}. Remove them from your selection and try again.`;
}

/**
 * Up to PASSAGES_PER_SOURCE chunks spread through each chosen source, grouped in the
 * order `sources` gives. Runs as the signed-in user, so RLS scopes it. A source with
 * no chunks (a scanned PDF, say) fails the whole run rather than summarizing nothing.
 */
export async function sampleSummaryPassages(
  supabase: Client,
  projectId: string,
  sources: SummarizableSource[],
): Promise<SummaryPassagesResult> {
  const { data, error } = await supabase.rpc('sample_source_chunks', {
    project_id: projectId,
    chunks_per_source: PASSAGES_PER_SOURCE,
    source_ids: sources.map((source) => source.id),
  });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const grouped = groupPassages(sources, data);
  const empty = grouped.filter((source) => source.chunks.length === 0);

  if (empty.length > 0) {
    return { ok: false, kind: 'no-text', titles: empty.map((source) => source.title) };
  }

  return { ok: true, sources: grouped };
}
