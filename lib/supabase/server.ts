import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component. Safe to ignore: proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}

// The signed-in user's verified JWT claims, or null. getClaims() checks the signature;
// the proxy already gates /api, but every data access checks again.
export async function getSupabaseUser(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.auth.getClaims();

  return data?.claims ?? null;
}
