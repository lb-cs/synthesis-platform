import type { Metadata } from 'next';
import { CircleAlert, Link2 } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { SourceUpload } from './source-upload';
import { SourcesList } from './sources-list';

export const metadata: Metadata = {
  title: 'Sources · Synthesis Platform',
};

function LoadError() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Could not load sources</EmptyTitle>
        <EmptyDescription>Refresh the page to try again.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export default async function SourcesPage({
  params,
}: PageProps<'/projects/[projectId]/sources'>) {
  const { projectId } = await params;

  // A malformed id can't match a row, and Postgres would reject it as a uuid anyway.
  if (!projectIdSchema.safeParse(projectId).success) {
    notFound();
  }

  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  // The upload builds the Storage path from the user's id.
  if (!supabaseUser) {
    redirect('/login');
  }

  const projectResult = await getProject(supabase, projectId);

  // RLS hides other users' projects, so theirs land here too.
  if (!projectResult.ok && projectResult.kind === 'not-found') {
    notFound();
  }

  if (!projectResult.ok) {
    return <LoadError />;
  }

  const sourcesResult = await listSources(supabase, projectId);

  if (!sourcesResult.ok) {
    return <LoadError />;
  }

  return (
    <>
      <PageHeader title="Sources" description="Files and links the AI can draw on.">
        {/* Not wired up: web and YouTube links are a stretch goal (CECS491-18). */}
        <Button variant="outline" disabled>
          <Link2 />
          Add link
          <Badge variant="secondary">Stretch</Badge>
        </Button>
      </PageHeader>

      <SourceUpload userId={supabaseUser.sub} projectId={projectId} />

      <SourcesList projectId={projectId} sources={sourcesResult.sources} />
    </>
  );
}
