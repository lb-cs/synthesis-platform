import * as z from 'zod';

export const emailSchema = z.object({
  email: z.email('Enter a valid email address.'),
});

export const codeSchema = emailSchema.extend({
  token: z.string().length(6, 'Enter the 6-digit code.'),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type CodeInput = z.infer<typeof codeSchema>;

// The `?error=` value /auth/callback sends back to /login when Google sign-in fails.
export const GOOGLE_ERROR_PARAM = 'google';

// Shown when Google sign-in fails or is cancelled, whether the action or the callback
// route caught it.
export const GOOGLE_SIGN_IN_ERROR =
  'Google sign-in did not finish. Try again, or use an email code.';
