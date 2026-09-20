import { createClient } from '@/lib/supabase/server';
import { createProject, listProjects } from '@/lib/projects';

import { createProjectSchema } from './schema';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || !ownerId) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const result = await listProjects(supabase, ownerId);

  if (!result.ok) {
    return Response.json({ error: 'Could not load projects.' }, { status: 500 });
  }

  return Response.json({ projects: result.projects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || !ownerId) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Title is required and must be 100 characters or fewer.' },
      { status: 400 },
    );
  }

  const result = await createProject(supabase, ownerId, parsed.data);

  if (!result.ok) {
    return Response.json({ error: 'Could not create project.' }, { status: 500 });
  }

  return Response.json({ project: result.project }, { status: 201 });
}
