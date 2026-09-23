import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

// proxy.ts already forks `/`; checking again keeps the route safe on its own.
export default async function RootPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect('/dashboard');
  }

  redirect('/home');
}
