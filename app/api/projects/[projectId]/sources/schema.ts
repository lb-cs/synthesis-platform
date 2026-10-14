import * as z from 'zod';

import { SOURCE_KINDS } from '@/lib/sources';

const title = z.string().trim().min(1).max(200);

export const createSourceSchema = z
  .object({
    kind: z.enum(SOURCE_KINDS),
    storagePath: z.string().min(1),
    title,
  })
  .strict();

export const renameSourceSchema = z.object({ title }).strict();
