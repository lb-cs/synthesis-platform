'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createProject as insertProject } from '@/lib/projects';
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
