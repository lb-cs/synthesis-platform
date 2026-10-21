import { getSource } from '@/lib/sources';
import { getFileUrl } from '@/lib/storage';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema } from '@/app/api/projects/schema';

type Context = RouteContext<'/api/projects/[projectId]/sources/[sourceId]/file'>;

// Opens a source's file: a stable link that redirects to a short-lived signed URL.
export async function GET(_request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId, sourceId } = await context.params;
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  const parsedSourceId = projectIdSchema.safeParse(sourceId);

  if (!parsedProjectId.success || !parsedSourceId.success) {
    return Response.json({ error: 'Source not found.' }, { status: 404 });
  }

  const sourceResult = await getSource(
    supabase,
    parsedProjectId.data,
    parsedSourceId.data,
  );

  if (!sourceResult.ok && sourceResult.kind === 'not-found') {
    return Response.json({ error: 'Source not found.' }, { status: 404 });
  }

  if (!sourceResult.ok) {
    return Response.json({ error: 'Could not load the source.' }, { status: 500 });
  }

  const urlResult = await getFileUrl(supabase, sourceResult.source.storagePath);

  if (!urlResult.ok && urlResult.kind === 'not-found') {
    return Response.json({ error: 'The source file is missing.' }, { status: 404 });
  }

  if (!urlResult.ok) {
    return Response.json({ error: 'Could not open the source.' }, { status: 500 });
  }

  return Response.redirect(urlResult.url, 302);
}
