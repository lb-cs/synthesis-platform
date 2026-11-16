'use client';

import { useParams, usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/workspace-switcher';

const STATIC_PAGE_LABELS: Record<string, string> = {
  '/settings': 'Settings',
  '/projects/new': 'New workspace',
};

const PROJECT_PAGE_LABELS: Record<string, string> = {
  '': 'Chat',
  '/sources': 'Sources',
  '/summaries': 'Summaries',
  '/analysis': 'Analysis',
  '/edit': 'Edit workspace',
};

/** The label after the switcher, or null where the switcher alone says where you are. */
function getPageLabel(pathname: string, projectId: string | undefined): string | null {
  if (!projectId) {
    return STATIC_PAGE_LABELS[pathname] ?? null;
  }

  const base = `/projects/${projectId}`;

  return PROJECT_PAGE_LABELS[pathname.slice(base.length)] ?? null;
}

/** The header trail: the workspace switcher, then the page you are on inside it. */
export function AppBreadcrumb({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();

  const pageLabel = getPageLabel(pathname, projectId);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <WorkspaceSwitcher workspaces={workspaces} />
        </BreadcrumbItem>
        {pageLabel && (
          <>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
