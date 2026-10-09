/**
 * Temporary read for the sources page. Delete this file and call `listSources` from
 * `@/lib/sources` once CECS491-61 lands.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import type { SourceKind, SourceListItem, SourceStatus } from './source-types';

export type SourcesResult = { ok: true; sources: SourceListItem[] } | { ok: false };

const SOURCE_COLUMNS = 'id, title, kind, status, processing_error, metadata, created_at';

export async function loadSources(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<SourcesResult> {
  const { data, error } = await supabase
    .from('sources')
    .select(SOURCE_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false };
  }

  const sources: SourceListItem[] = data.map((row) => {
    return {
      id: row.id,
      title: row.title,
      // CHECK constraints on the table limit these columns to the literal sets.
      kind: row.kind as SourceKind,
      status: row.status as SourceStatus,
      processingError: row.processing_error,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  });

  return { ok: true, sources };
}
