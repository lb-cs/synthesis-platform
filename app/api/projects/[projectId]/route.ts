import { getProject } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/projects/[projectId]'>,
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || !ownerId) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const result = await getProject(supabase, ownerId, projectId);

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not load project.' }, { status: 500 });
  }

  return Response.json({ project: result.project });
}
