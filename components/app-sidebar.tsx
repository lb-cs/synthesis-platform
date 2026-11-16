'use client';

import { BookOpen, FileText, LayoutGrid, Layers, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import type { LucideIcon } from 'lucide-react';

import { LogoMark } from '@/components/logo-mark';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const MAIN_NAV: NavItem[] = [
  { title: 'Workspaces', href: '/workspaces', icon: LayoutGrid },
];

function getProjectNav(projectId: string): NavItem[] {
  const base = `/projects/${projectId}`;

  return [
    { title: 'Chat', href: base, icon: MessageSquare },
    { title: 'Sources', href: `${base}/sources`, icon: FileText },
    { title: 'Summaries', href: `${base}/summaries`, icon: BookOpen },
    { title: 'Analysis', href: `${base}/analysis`, icon: Layers },
  ];
}

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();

  // The workspace group only exists while a workspace is open.
  const projectNav = projectId ? getProjectNav(projectId) : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/workspaces" />}>
              <div className="flex size-8 shrink-0 items-center justify-center">
                <LogoMark className="size-8" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Synthesis</span>
                <span className="truncate text-xs">Research workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup items={MAIN_NAV} pathname={pathname} />
        {projectNav.length > 0 && (
          <NavGroup label="Workspace" items={projectNav} pathname={pathname} />
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser email={email} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.href}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
