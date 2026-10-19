import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

// Service-role client. It bypasses RLS, so use it only where a signed-in user's own
// client cannot do the job (deleting an auth user). Server-only: never import it from a
// client component, and never give the key a NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
