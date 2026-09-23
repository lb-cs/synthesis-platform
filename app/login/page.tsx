import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
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
    <main className="flex flex-1 flex-col">
      {/* Same height and gutter as SiteHeader, so the brand doesn't shift on the way here. */}
      <div className="mx-auto flex h-14 items-center px-6 pt-10">
        <Link href="/home" className="flex items-center gap-2 font-medium">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          Synthesis
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <LoginForm />
      </div>
    </main>
  );
}
