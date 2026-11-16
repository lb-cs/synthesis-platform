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

import { signOut } from '@/app/login/actions';

import { ChangeEmailForm } from './change-email-form';
import { DeleteAccountButton } from './delete-account-button';

export const metadata: Metadata = {
  title: 'Settings · Synthesis Platform',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect('/login');
  }

  const { data: identityData } = await supabase.auth.getUserIdentities();
  const hasGoogle = identityData?.identities.some((identity) => {
    return identity.provider === 'google';
  });

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
            <ChangeEmailForm currentEmail={data.claims.email ?? ''} />
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
            <CardTitle>Sign-in methods</CardTitle>
            <CardDescription>
              {hasGoogle
                ? 'You can sign in with Google or a one-time code.'
                : 'Sign in with a one-time code, or use Continue with Google on the sign-in page with this same email to add Google.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Email one-time code</span>
              <Badge variant="secondary">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Google</span>
              <Badge variant={hasGoogle ? 'secondary' : 'outline'}>
                {hasGoogle ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently delete your account and everything in it: projects, sources,
              chat history and uploaded files. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <DeleteAccountButton />
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
