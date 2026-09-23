import { SiteHeader } from '@/components/site-header';
import { createClient } from '@/lib/supabase/server';

// Public, so a signed-in visitor can land here too; the header offers them the dashboard.
export default async function HomeLayout({ children }: LayoutProps<'/home'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  return (
    <>
      <SiteHeader isSignedIn={isSignedIn} />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>Synthesis Platform</span>
          <span>CECS 491 · Team Quintessential Algorithms</span>
        </div>
      </footer>
    </>
  );
}
