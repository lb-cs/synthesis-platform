import * as z from 'zod';

export const askQuestionSchema = z.object({
  question: z.string().trim().min(1).max(4000),
});
