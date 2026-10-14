import { getProject } from '@/lib/projects';
import { createSource, listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema } from '@/app/api/projects/schema';

import { createSourceSchema } from './schema';

type Context = RouteContext<'/api/projects/[projectId]/sources'>;

async function getProjectId(context: Context) {
  const { projectId } = await context.params;
  const parsed = projectIdSchema.safeParse(projectId);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function GET(_request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const projectId = await getProjectId(context);

  if (!projectId) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const projectResult = await getProject(supabase, projectId);

  if (!projectResult.ok && projectResult.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!projectResult.ok) {
    return Response.json({ error: 'Could not load project.' }, { status: 500 });
  }

  const result = await listSources(supabase, projectId);

  if (!result.ok) {
    return Response.json({ error: 'Could not load sources.' }, { status: 500 });
  }

  return Response.json({ sources: result.sources });
}

export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const projectId = await getProjectId(context);

  if (!projectId) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const projectResult = await getProject(supabase, projectId);

  if (!projectResult.ok && projectResult.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!projectResult.ok) {
    return Response.json({ error: 'Could not load project.' }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSourceSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Send a title (1–200 characters), source type, and uploaded file path.' },
      { status: 400 },
    );
  }

  const expectedPathPrefix = `${supabaseUser.sub}/${projectId}/`;

  if (!parsed.data.storagePath.startsWith(expectedPathPrefix)) {
    return Response.json({ error: 'The file must belong to this project.' }, { status: 400 });
  }

  const result = await createSource(supabase, projectId, parsed.data);

  if (!result.ok) {
    return Response.json({ error: 'Could not create the source.' }, { status: 500 });
  }

  const location = `/api/projects/${projectId}/sources/${result.source.id}`;

  return Response.json(
    { source: result.source },
    { status: 201, headers: { Location: location } },
  );
}
