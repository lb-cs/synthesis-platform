import * as z from 'zod';

import {
  MAX_COMPARED_SOURCES,
  MAX_TOPIC_LENGTH,
  MIN_COMPARED_SOURCES,
} from '@/lib/comparison';

export const compareSourcesSchema = z.object({
  topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
  sourceIds: z
    .array(z.uuid())
    .min(MIN_COMPARED_SOURCES)
    .max(MAX_COMPARED_SOURCES)
    .refine((ids) => new Set(ids).size === ids.length),
});
