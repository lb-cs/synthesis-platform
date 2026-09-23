import { createProject, listProjects } from '@/lib/projects';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { createProjectSchema } from './schema';

export async function GET() {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const result = await listProjects(supabase);

  if (!result.ok) {
    return Response.json({ error: 'Could not load projects.' }, { status: 500 });
  }

  return Response.json({ projects: result.projects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  // Malformed JSON becomes null and fails validation like any other bad body.
  const body: unknown = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Title is required and must be 100 characters or fewer.' },
      { status: 400 },
    );
  }

  const result = await createProject(supabase, parsed.data);

  if (!result.ok) {
    return Response.json({ error: 'Could not create project.' }, { status: 500 });
  }

  const location = `/api/projects/${result.project.id}`;

  return Response.json(
    { project: result.project },
    { status: 201, headers: { Location: location } },
  );
}
