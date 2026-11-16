import { SiteHeader } from '@/components/site-header';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { createClient } from '@/lib/supabase/server';

// Public, so a signed-in visitor can land here too; the header offers them their workspaces.
export default async function HomeLayout({ children }: LayoutProps<'/home'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  return (
    <>
      <SiteHeader isSignedIn={isSignedIn} />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <span>Synthesis Platform</span>
            <span>Built by Team Quintessential Algorithms</span>
          </div>
          <ThemeSwitcher />
        </div>
      </footer>
    </>
  );
}
