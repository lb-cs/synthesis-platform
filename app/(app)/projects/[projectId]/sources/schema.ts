import * as z from 'zod';

export const removeSourceSchema = z.object({
  projectId: z.uuid(),
  sourceId: z.uuid(),
});

export type RemoveSourceInput = z.infer<typeof removeSourceSchema>;
