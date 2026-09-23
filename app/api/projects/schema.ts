import * as z from 'zod';

// Mirrors the check constraint on public.projects.title.
const title = z.string().trim().min(1).max(100);

// A blank description is stored as null, never ''.
const description = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable();

export const projectIdSchema = z.uuid();

export const createProjectSchema = z.object({
  title,
  description: description.optional(),
});

export const updateProjectSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
  })
  .refine((input) => input.title !== undefined || input.description !== undefined);
