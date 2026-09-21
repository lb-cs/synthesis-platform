import * as z from 'zod';

import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/projects/types';

export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(TITLE_MAX_LENGTH, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`),
  description: z
    .string()
    .trim()
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
