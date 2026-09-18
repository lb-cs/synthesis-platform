import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { AppBreadcrumb } from '@/components/app-breadcrumb';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

// Every signed-in screen lives under this group: sidebar on the left, page on the right.
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  // proxy.ts already guards these routes; checking again keeps the shell safe on its own.
  if (error || !data?.claims) {
    redirect('/login');
  }

  // Sign-in is email-only, so the email claim is always present.
  const email = data.claims.email!;

  return (
    <SidebarProvider>
      <AppSidebar email={email} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <AppBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
