/**
 * Project CRUD. Every query runs as the signed-in user, so RLS on `public.projects`
 * scopes it to their rows — another user's project reads as not found.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/lib/supabase/database.types';

export type Project = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = Pick<TablesInsert<'projects'>, 'title' | 'description'>;

export type UpdateProjectInput = Pick<TablesUpdate<'projects'>, 'title' | 'description'>;

export type ProjectResult =
  { ok: true; project: Project } | { ok: false; kind: 'not-found' | 'database-error' };

export type ProjectListResult =
  { ok: true; projects: Project[] } | { ok: false; kind: 'database-error' };

export type DeleteProjectResult =
  { ok: true } | { ok: false; kind: 'not-found' | 'database-error' };

type Client = SupabaseClient<Database>;

type ProjectRow = Pick<
  Tables<'projects'>,
  'id' | 'title' | 'description' | 'created_at' | 'updated_at'
>;

const PROJECT_COLUMNS = 'id, title, description, created_at, updated_at';

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(supabase: Client): Promise<ProjectListResult> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, projects: data.map(toProject) };
}

export async function getProject(
  supabase: Client,
  projectId: string,
): Promise<ProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  if (!data) {
    return { ok: false, kind: 'not-found' };
  }

  return { ok: true, project: toProject(data) };
}

// user_id is left out on purpose: the column defaults to auth.uid().
export async function createProject(
  supabase: Client,
  input: CreateProjectInput,
): Promise<ProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .insert(input)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, project: toProject(data) };
}

export async function updateProject(
  supabase: Client,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', projectId)
    .select(PROJECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  if (!data) {
    return { ok: false, kind: 'not-found' };
  }

  return { ok: true, project: toProject(data) };
}

// Sources, chunks, and chat cascade in the database. Storage files do not.
export async function deleteProject(
  supabase: Client,
  projectId: string,
): Promise<DeleteProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  if (!data) {
    return { ok: false, kind: 'not-found' };
  }

  return { ok: true };
}
