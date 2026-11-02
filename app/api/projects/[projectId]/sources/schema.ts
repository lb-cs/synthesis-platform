import * as z from 'zod';

import { normalizeLinkUrl } from '@/lib/link-url';
import { FILE_SOURCE_KINDS } from '@/lib/sources';

const title = z.string().trim().min(1).max(200);

/** A typed web address, checked and turned into the form that is stored. */
export const linkUrlSchema = z.string().transform((value, context) => {
  const result = normalizeLinkUrl(value);

  if (!result.ok) {
    context.addIssue({ code: 'custom', message: result.message });

    return z.NEVER;
  }

  return result.url;
});

// A source is a file in Storage or a web link, never both: the database enforces it too.
export const createSourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.enum(FILE_SOURCE_KINDS),
      storagePath: z.string().min(1),
      title,
    })
    .strict(),
  z
    .object({
      kind: z.literal('link'),
      url: linkUrlSchema,
      title: title.optional(),
    })
    .strict(),
]);

export const renameSourceSchema = z.object({ title }).strict();
