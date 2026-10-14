'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createProject as insertProject,
  deleteProject as removeProject,
  updateProject as saveProject,
} from '@/lib/projects';
import { projectIdSchema } from '@/app/api/projects/schema';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

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
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  // A blank description is stored as null, never '' — same rule as the API.
  const result = await insertProject(supabase, {
    title: parsed.data.title,
    description: parsed.data.description || null,
  });

  if (!result.ok) {
    return { error: 'Could not create the project. Try again.' };
  }

  revalidatePath('/dashboard');
  redirect(`/projects/${result.project.id}`);
}

export async function updateProject(input: {
  projectId: string;
  values: CreateProjectInput;
}): Promise<{ error?: string }> {
  const parsedProjectId = projectIdSchema.safeParse(input.projectId);

  if (!parsedProjectId.success) {
    return { error: 'This project no longer exists. Refresh the page.' };
  }

  const parsed = createProjectSchema.safeParse(input.values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  const projectId = parsedProjectId.data;
  const result = await saveProject(supabase, projectId, {
    title: parsed.data.title,
    description: parsed.data.description || null,
  });

  if (!result.ok && result.kind === 'not-found') {
    return { error: 'This project no longer exists. Refresh the page.' };
  }

  if (!result.ok) {
    return { error: 'Could not update the project. Try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/projects/${projectId}`);

  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);

  if (!parsedProjectId.success) {
    return { error: 'This project no longer exists. Refresh the page.' };
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return { error: 'Your session expired. Sign in again.' };
  }

  const result = await removeProject(supabase, parsedProjectId.data);

  if (!result.ok && result.kind === 'not-found') {
    return { error: 'This project no longer exists. Refresh the page.' };
  }

  if (!result.ok && result.kind === 'storage-error') {
    revalidatePath('/dashboard');
    redirect('/dashboard?notice=storage-cleanup');
  }

  if (!result.ok) {
    return { error: 'Could not delete the project. Try again.' };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
