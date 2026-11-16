import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoMark } from '@/components/logo-mark';
import { createClient } from '@/lib/supabase/server';

import { LoginForm } from './login-form';
import { GOOGLE_ERROR_PARAM, GOOGLE_SIGN_IN_ERROR } from './schema';

export const metadata: Metadata = {
  title: 'Sign in · Synthesis Platform',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // proxy.ts already bounces signed-in users; checking again keeps the page safe on its own.
  if (data?.claims) {
    redirect('/workspaces');
  }

  // /auth/callback sends a failed or cancelled Google sign-in back here with ?error=google.
  const { error } = await searchParams;
  const googleError = error === GOOGLE_ERROR_PARAM ? GOOGLE_SIGN_IN_ERROR : null;

  return (
    <main className="flex flex-1 flex-col">
      {/* Same height and gutter as SiteHeader, so the brand doesn't shift on the way here. */}
      <div className="mx-auto flex h-14 items-center px-6 pt-10">
        <Link href="/home" className="flex items-center gap-2 font-medium">
          <LogoMark />
          Synthesis
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <LoginForm googleError={googleError} />
      </div>
    </main>
  );
}
