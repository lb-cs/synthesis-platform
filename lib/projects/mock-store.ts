import 'server-only';
import { randomUUID } from 'crypto';

import type { CreateProjectInput, Project } from './types';

/**
 * TEMPORARY in-memory data layer.
 *
 * There is no `projects` table yet (CECS491-27) and no real API route (CECS491-26).
 * This fakes both so the create/list/detail UI (CECS491-25) can be built, tested,
 * and demoed end-to-end without being blocked on either.
 *
 * Swap-out plan once the table lands: replace the array below with Supabase queries
 * (see `lib/supabase/server.ts` for the client pattern already used in
 * `app/login/actions.ts`). Keep these three function signatures the same so
 * `app/(app)/projects/actions.ts` doesn't need to change shape, only its
 * implementation.
 *
 * Only lives for the dev server process — resets on restart, not shared across
 * serverless invocations in production. Local-dev/demo aid only.
 */

const projects: Project[] = [];

export async function listProjects(): Promise<Project[]> {
  return [...projects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return projects.find((p) => p.id === id) ?? null;
}

export async function createProject(
  input: CreateProjectInput,
  ownerId: string,
): Promise<Project> {
  const title = input.title.trim();
  const description = input.description?.trim() || null;

  const project: Project = {
    id: randomUUID(),
    title,
    description,
    ownerId,
    createdAt: new Date().toISOString(),
  };

  projects.push(project);
  return project;
}
