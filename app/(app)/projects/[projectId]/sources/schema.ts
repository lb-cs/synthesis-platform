import * as z from 'zod';

export const sourceIdsSchema = z.object({
  projectId: z.uuid(),
  sourceId: z.uuid(),
});

export const removeSourceSchema = sourceIdsSchema;

export type SourceIdsInput = z.infer<typeof sourceIdsSchema>;
export type RemoveSourceInput = SourceIdsInput;
