/**
 * Source CRUD. Every query runs as the signed-in user, so RLS on `public.sources` and
 * the `sources` bucket scopes it to their projects — another user's source reads as
 * not found. Only delete is here so far; create, list, and rename land with CECS491-61.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

export type DeleteSourceResult =
  { ok: true } | { ok: false; kind: 'not-found' | 'database-error' | 'storage-error' };

type Client = SupabaseClient<Database>;

const SOURCES_BUCKET = 'sources';

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
