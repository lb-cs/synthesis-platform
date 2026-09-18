import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { signOut } from '../login/actions';

export const metadata: Metadata = {
  title: 'Dashboard · Synthesis Platform',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  // proxy.ts already guards this route; checking again keeps the page safe on its own.
  if (error || !data?.claims) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Signed in as{' '}
            <span className="font-medium text-foreground">{data.claims.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder. Projects and workspaces will live here.
          </p>
        </CardContent>
        <CardFooter>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
