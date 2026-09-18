'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type Crumb = {
  label: string;
  href?: string;
};

const DASHBOARD_CRUMB: Crumb = { label: 'Dashboard', href: '/dashboard' };

const STATIC_CRUMBS: Record<string, Crumb[]> = {
  '/dashboard': [{ label: 'Dashboard' }],
  '/settings': [{ label: 'Settings' }],
  '/projects/new': [DASHBOARD_CRUMB, { label: 'New project' }],
};

const PROJECT_PAGE_LABELS: Record<string, string> = {
  '': 'Workspace',
  '/sources': 'Sources',
  '/summaries': 'Summaries',
  '/analysis': 'Analysis',
};

function getCrumbs(pathname: string, projectId: string | undefined): Crumb[] {
  if (!projectId) {
    return STATIC_CRUMBS[pathname] ?? [{ label: 'Synthesis' }];
  }

  const base = `/projects/${projectId}`;
  const pageLabel = PROJECT_PAGE_LABELS[pathname.slice(base.length)] ?? 'Workspace';

  // Reads "Project" until projects have titles to show here.
  return [DASHBOARD_CRUMB, { label: 'Project', href: base }, { label: pageLabel }];
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();

  const crumbs = getCrumbs(pathname, projectId);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={crumb.label}>
              <BreadcrumbItem className={isLast ? undefined : 'hidden md:block'}>
                {crumb.href && !isLast ? (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
