'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import {
  createProject as createProjectInStore,
  getProject as getProjectFromStore,
  listProjects as listProjectsFromStore,
} from '@/lib/projects/mock-store';
import type { Project } from '@/lib/projects/types';

import { createProjectSchema, type CreateProjectInput } from './schema';

// Server actions are public endpoints, so re-validate even though the form already did.

export async function createProject(
  input: CreateProjectInput,
): Promise<{ error?: string }> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError || !data?.claims) {
    return { error: 'Your session expired. Sign in again.' };
  }

  let project: Project;
  try {
    project = await createProjectInStore(parsed.data, data.claims.sub);
  } catch {
    return { error: 'Could not create the project. Try again.' };
  }

  revalidatePath('/dashboard');
  redirect(`/projects/${project.id}`);
}

export async function listProjects(): Promise<Project[]> {
  return listProjectsFromStore();
}

export async function getProject(id: string): Promise<Project | null> {
  return getProjectFromStore(id);
}
