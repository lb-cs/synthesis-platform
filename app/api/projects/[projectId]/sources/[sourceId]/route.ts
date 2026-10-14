import { deleteSource, renameSource } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema } from '@/app/api/projects/schema';

import { renameSourceSchema } from '../schema';

type Context = RouteContext<'/api/projects/[projectId]/sources/[sourceId]'>;

export async function PATCH(request: Request, context: Context) {
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

  const body: unknown = await request.json().catch(() => null);
  const parsed = renameSourceSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Send a title between 1 and 200 characters.' },
      { status: 400 },
    );
  }

  const result = await renameSource(
    supabase,
    parsedProjectId.data,
    parsedSourceId.data,
    parsed.data.title,
  );

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Source not found.' }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not rename the source.' }, { status: 500 });
  }

  return Response.json({ source: result.source });
}

export async function DELETE(_request: Request, context: Context) {
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

  const result = await deleteSource(supabase, parsedProjectId.data, parsedSourceId.data);

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Source not found.' }, { status: 404 });
  }

  if (!result.ok && result.kind === 'storage-error') {
    return Response.json(
      { error: 'The source was deleted, but its file could not be removed.' },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not delete the source.' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
