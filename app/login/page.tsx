import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · Synthesis Platform',
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // proxy.ts already bounces signed-in users; checking again keeps the page safe on its own.
  if (data?.claims) {
    redirect('/dashboard');
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <LoginForm />
    </main>
  );
}
