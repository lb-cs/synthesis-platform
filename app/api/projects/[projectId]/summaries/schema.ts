import * as z from 'zod';

import { MAX_SUMMARIZED_SOURCES, MIN_SUMMARIZED_SOURCES } from '@/lib/summaries';

export const summarizeSourcesSchema = z.object({
  sourceIds: z
    .array(z.uuid())
    .min(MIN_SUMMARIZED_SOURCES)
    .max(MAX_SUMMARIZED_SOURCES)
    .refine((ids) => new Set(ids).size === ids.length),
});
