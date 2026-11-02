import * as z from 'zod';

import { linkUrlSchema } from '@/app/api/projects/[projectId]/sources/schema';

export const sourceIdsSchema = z.object({
  projectId: z.uuid(),
  sourceId: z.uuid(),
});

export const removeSourceSchema = sourceIdsSchema;

export type SourceIdsInput = z.infer<typeof sourceIdsSchema>;
export type RemoveSourceInput = SourceIdsInput;

export const addLinkFormSchema = z.object({ url: linkUrlSchema });

export const addLinkSchema = z.object({ projectId: z.uuid(), url: linkUrlSchema });

export type AddLinkFormInput = z.infer<typeof addLinkFormSchema>;
export type AddLinkInput = z.infer<typeof addLinkSchema>;
