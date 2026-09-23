import { deleteProject, getProject, updateProject } from '@/lib/projects';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema, updateProjectSchema } from '../schema';

type Context = RouteContext<'/api/projects/[projectId]'>;

export async function GET(_request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId } = await context.params;

  // A malformed id can't match a row, so it is simply not found.
  if (!projectIdSchema.safeParse(projectId).success) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const result = await getProject(supabase, projectId);

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not load project.' }, { status: 500 });
  }

  return Response.json({ project: result.project });
}

export async function PATCH(request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId } = await context.params;

  if (!projectIdSchema.safeParse(projectId).success) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Send a title (1–100 characters), a description, or both.' },
      { status: 400 },
    );
  }

  const result = await updateProject(supabase, projectId, parsed.data);

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not update project.' }, { status: 500 });
  }

  return Response.json({ project: result.project });
}

export async function DELETE(_request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId } = await context.params;

  if (!projectIdSchema.safeParse(projectId).success) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const result = await deleteProject(supabase, projectId);

  if (!result.ok && result.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json({ error: 'Could not delete project.' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
