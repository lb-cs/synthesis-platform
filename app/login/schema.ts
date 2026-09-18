import * as z from 'zod';

export const emailSchema = z.object({
  email: z.email('Enter a valid email address.'),
});

export const codeSchema = emailSchema.extend({
  token: z.string().length(6, 'Enter the 6-digit code.'),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type CodeInput = z.infer<typeof codeSchema>;
