import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { signOut } from '@/app/login/actions';

export const metadata: Metadata = {
  title: 'Settings · Synthesis Platform',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect('/login');
  }

  return (
    <>
      <PageHeader title="Settings" description="Your account and how you sign in." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>The email you sign in with.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={data.claims.email} readOnly />
              <FieldDescription>
                Changing your email is not supported yet.
              </FieldDescription>
            </Field>
          </CardContent>
          <CardFooter>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sign-in methods
              <Badge variant="secondary">Stretch</Badge>
            </CardTitle>
            <CardDescription>
              Today you sign in with a one-time code. Google sign-in is planned.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            {/* Not wired up: Google OAuth is a stretch goal (CECS491-17). */}
            <Button variant="outline" disabled>
              Connect Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
