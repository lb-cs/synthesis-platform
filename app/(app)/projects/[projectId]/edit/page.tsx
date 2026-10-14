import type { Metadata } from 'next';
import { CircleAlert } from 'lucide-react';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { projectIdSchema } from '@/app/api/projects/schema';
import { getProject } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';

import { EditProjectForm } from './edit-project-form';

export const metadata: Metadata = {
  title: 'Edit project · Synthesis Platform',
};

export default async function EditProjectPage({
  params,
}: PageProps<'/projects/[projectId]/edit'>) {
  const { projectId } = await params;

  if (!projectIdSchema.safeParse(projectId).success) {
    notFound();
  }

  const supabase = await createClient();
  const result = await getProject(supabase, projectId);

  if (!result.ok && result.kind === 'not-found') {
    notFound();
  }

  if (!result.ok) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>Could not load project</EmptyTitle>
          <EmptyDescription>Refresh the page to try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <PageHeader title="Edit project" description="Update the title or description." />
      <EditProjectForm projectId={projectId} project={result.project} />
    </>
  );
}
