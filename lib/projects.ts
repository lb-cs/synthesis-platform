import type { SupabaseClient } from '@supabase/supabase-js';

export type Project = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
};

export type CreateProjectInput = {
  title: string;
  description?: string | null;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
};

type ProjectResult =
  { ok: true; project: Project } | { ok: false; kind: 'not-found' | 'database-error' };

type ProjectListResult =
  { ok: true; projects: Project[] } | { ok: false; kind: 'database-error' };

const PROJECT_COLUMNS = 'id, title, description, owner_id';

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
  };
}

export async function createProject(
  supabase: SupabaseClient,
  ownerId: string,
  input: CreateProjectInput,
): Promise<ProjectResult> {
  const description = input.description || null;
  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: input.title,
      description,
      owner_id: ownerId,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, project: toProject(data as ProjectRow) };
}

export async function listProjects(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<ProjectListResult> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('owner_id', ownerId);

  if (error || !data) {
    return { ok: false, kind: 'database-error' };
  }

  const rows = data as ProjectRow[];
  const projects = rows.map((row) => {
    return toProject(row);
  });

  return { ok: true, projects };
}

export async function getProject(
  supabase: SupabaseClient,
  ownerId: string,
  projectId: string,
): Promise<ProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  if (!data) {
    return { ok: false, kind: 'not-found' };
  }

  return { ok: true, project: toProject(data as ProjectRow) };
}
