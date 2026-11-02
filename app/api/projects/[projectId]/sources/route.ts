import { getLinkTitle } from '@/lib/link-url';
import { getProject } from '@/lib/projects';
import {
  createLinkSource,
  createSource,
  listSources,
  type SourceResult,
} from '@/lib/sources';
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

function respondWithSource(projectId: string, result: SourceResult) {
  if (!result.ok) {
    return Response.json({ error: 'Could not create the source.' }, { status: 500 });
  }

  const location = `/api/projects/${projectId}/sources/${result.source.id}`;

  return Response.json(
    { source: result.source },
    { status: 201, headers: { Location: location } },
  );
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
      {
        error:
          'Send a file (type, title, and uploaded file path) or a link (its web address, and an optional title).',
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  if (input.kind === 'link') {
    const title = input.title ?? getLinkTitle(input.url);
    const linkResult = await createLinkSource(supabase, projectId, {
      title,
      url: input.url,
    });

    return respondWithSource(projectId, linkResult);
  }

  const expectedPathPrefix = `${supabaseUser.sub}/${projectId}/`;

  if (!input.storagePath.startsWith(expectedPathPrefix)) {
    return Response.json(
      { error: 'The file must belong to this project.' },
      { status: 400 },
    );
  }

  const result = await createSource(supabase, projectId, input);

  return respondWithSource(projectId, result);
}
