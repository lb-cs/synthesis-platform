import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Synthesis Platform</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Next.js, Tailwind CSS, shadcn/ui, and Supabase auth. Nothing else is wired up
          yet.
        </p>
      </div>
      <div className="flex gap-3">
        {isSignedIn ? (
          <Button render={<Link href="/dashboard" />} nativeButton={false}>
            Dashboard
          </Button>
        ) : (
          <Button render={<Link href="/login" />} nativeButton={false}>
            Sign in
          </Button>
        )}
        <Button
          variant="outline"
          render={<Link href="/api/health" />}
          nativeButton={false}
        >
          /api/health
        </Button>
      </div>
    </main>
  );
}
