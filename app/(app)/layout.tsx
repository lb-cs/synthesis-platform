import { redirect } from 'next/navigation';

import { listProjects } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';
import { AppBreadcrumb } from '@/components/app-breadcrumb';
import { AppSidebar } from '@/components/app-sidebar';
import { CreateNewMenu } from '@/components/create-new-menu';
import type { WorkspaceOption } from '@/components/workspace-switcher';
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

  // The header's switcher lists every workspace. If the list fails to load, the switcher
  // shows none rather than taking the whole shell down; the page itself reports errors.
  const result = await listProjects(supabase);
  const workspaces: WorkspaceOption[] = result.ok
    ? result.projects.map((project) => {
        return { id: project.id, title: project.title };
      })
    : [];

  return (
    <SidebarProvider>
      <AppSidebar email={email} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <AppBreadcrumb workspaces={workspaces} />
          <div className="ml-auto">
            <CreateNewMenu />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
