import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleAlert, GitCompare, Layers } from 'lucide-react';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { getComparableSources, MIN_COMPARED_SOURCES } from '@/lib/comparison';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ComparePanel } from './compare-panel';

export const metadata: Metadata = {
  title: 'Analysis · Synthesis Platform',
};

const COMPARE_UNAVAILABLE_ID = 'compare-unavailable';

function LoadError() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Could not load this project&apos;s sources</EmptyTitle>
        <EmptyDescription>Refresh the page to try again.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function getReadyCountText(readyCount: number): string {
  if (readyCount === 0) {
    return 'None of this project’s sources are ready yet.';
  }

  return 'Only one of this project’s sources is ready.';
}

// Why the Compare tab is disabled; the tab points here with aria-describedby.
function CompareUnavailable({
  projectId,
  readyCount,
}: {
  projectId: string;
  readyCount: number;
}) {
  return (
    <Empty id={COMPARE_UNAVAILABLE_ID}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GitCompare />
        </EmptyMedia>
        <EmptyTitle>
          Compare needs at least {MIN_COMPARED_SOURCES} ready sources
        </EmptyTitle>
        <EmptyDescription>
          {getReadyCountText(readyCount)} A source is ready once it finishes processing.
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

export default async function AnalysisPage({
  params,
}: PageProps<'/projects/[projectId]/analysis'>) {
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

  const comparable = getComparableSources(sourcesResult.sources);
  const canCompare = comparable.length >= MIN_COMPARED_SOURCES;

  return (
    <>
      <PageHeader
        title="Analysis"
        description="Compare concepts and surface themes across the sources in this project."
      />

      {/* null selects no tab: Base UI needs an enabled default when rendering on the server. */}
      <Tabs defaultValue={canCompare ? 'compare' : null}>
        <TabsList>
          <TabsTrigger
            value="compare"
            disabled={!canCompare}
            aria-describedby={canCompare ? undefined : COMPARE_UNAVAILABLE_ID}
          >
            <GitCompare />
            Compare
          </TabsTrigger>
          <TabsTrigger value="themes" disabled>
            <Layers />
            Themes
            <Badge variant="secondary">Soon</Badge>
          </TabsTrigger>
        </TabsList>

        {!canCompare && (
          <CompareUnavailable projectId={projectId} readyCount={comparable.length} />
        )}

        <TabsContent value="compare" className="pt-4">
          <ComparePanel projectId={projectId} sources={comparable} />
        </TabsContent>
      </Tabs>
    </>
  );
}
