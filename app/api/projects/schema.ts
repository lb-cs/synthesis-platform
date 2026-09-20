import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().nullable().optional(),
});
