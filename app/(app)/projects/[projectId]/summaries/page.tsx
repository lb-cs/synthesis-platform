import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient } from '@/lib/supabase/server';
import { getSummarizableSources } from '@/lib/summaries';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { SummariesPanel } from './summaries-panel';

export const metadata: Metadata = {
  title: 'Summaries · Synthesis Platform',
};

function LoadError() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Could not load this workspace&apos;s sources</EmptyTitle>
        <EmptyDescription>Refresh the page to try again.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function NoReadySources({ projectId }: { projectId: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>No sources are ready to summarize</EmptyTitle>
        <EmptyDescription>
          A source is ready once it finishes processing. Add one, or wait for the ones you
          added.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          render={<Link href={`/projects/${projectId}/sources`} />}
          nativeButton={false}
        >
          Go to Sources
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export default async function SummariesPage({
  params,
}: PageProps<'/projects/[projectId]/summaries'>) {
  const { projectId } = await params;

  // A malformed id can't match a row, and Postgres would reject it as a uuid anyway.
  if (!projectIdSchema.safeParse(projectId).success) {
    notFound();
  }

  const supabase = await createClient();
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

  const summarizable = getSummarizableSources(sourcesResult.sources);

  return (
    <>
      <PageHeader
        title="Summaries"
        description="Structured summaries of one or more sources, with citations."
      />

      {summarizable.length === 0 ? (
        <NoReadySources projectId={projectId} />
      ) : (
        <SummariesPanel projectId={projectId} sources={summarizable} />
      )}
    </>
  );
}
