/**
 * Source CRUD. Every query runs as the signed-in user, so RLS on `public.sources` and
 * the `sources` bucket scopes it to their projects — another user's source reads as
 * not found. List and delete are here so far; create and rename land with CECS491-61.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json, Tables } from '@/lib/supabase/database.types';

// Mirror the check constraints on public.sources.status and public.sources.kind.
export const SOURCE_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export const SOURCE_KINDS = ['pdf', 'text'] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type Source = {
  id: string;
  title: string;
  kind: SourceKind;
  status: SourceStatus;
  processingError: string | null;
  metadata: Json;
  createdAt: string;
};

export type SourceListResult =
  { ok: true; sources: Source[] } | { ok: false; kind: 'database-error' };

export type DeleteSourceResult =
  { ok: true } | { ok: false; kind: 'not-found' | 'database-error' | 'storage-error' };

type Client = SupabaseClient<Database>;

type SourceRow = Pick<
  Tables<'sources'>,
  'id' | 'title' | 'kind' | 'status' | 'processing_error' | 'metadata' | 'created_at'
>;

const SOURCE_COLUMNS = 'id, title, kind, status, processing_error, metadata, created_at';

const SOURCES_BUCKET = 'sources';

function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    title: row.title,
    // The check constraints limit these columns to the literal sets above.
    kind: row.kind as SourceKind,
    status: row.status as SourceStatus,
    processingError: row.processing_error,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function listSources(
  supabase: Client,
  projectId: string,
): Promise<SourceListResult> {
  const { data, error } = await supabase
    .from('sources')
    .select(SOURCE_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, sources: data.map(toSource) };
}

// Row first, then file: a failure in between leaves an unreachable file, never a row
// pointing at a missing one. Chunks and citations cascade; Storage does not.
export async function deleteSource(
  supabase: Client,
  projectId: string,
  sourceId: string,
): Promise<DeleteSourceResult> {
  const { data, error } = await supabase
    .from('sources')
    .delete()
    .eq('id', sourceId)
    .eq('project_id', projectId)
    .select('storage_path')
    .maybeSingle();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  if (!data) {
    return { ok: false, kind: 'not-found' };
  }

  const { error: storageError } = await supabase.storage
    .from(SOURCES_BUCKET)
    .remove([data.storage_path]);

  if (storageError) {
    return { ok: false, kind: 'storage-error' };
  }

  return { ok: true };
}
