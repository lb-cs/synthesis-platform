import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleAlert, GitCompare, Layers } from 'lucide-react';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import {
  getComparableSources,
  MAX_COMPARED_SOURCES,
  MIN_COMPARED_SOURCES,
} from '@/lib/comparison';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient } from '@/lib/supabase/server';
import {
  getThemesReadiness,
  MAX_THEME_SOURCES,
  type ThemesReadiness,
} from '@/lib/themes';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ComparePanel } from './compare-panel';
import { ThemesPanel } from './themes-panel';

export const metadata: Metadata = {
  title: 'Analysis · Synthesis Platform',
};

const NOT_ENOUGH_SOURCES_ID = 'analysis-not-enough-sources';

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

function SourcesButton({ projectId }: { projectId: string }) {
  return (
    <Button
      variant="outline"
      render={<Link href={`/projects/${projectId}/sources`} />}
      nativeButton={false}
    >
      Go to Sources
    </Button>
  );
}

// Both tabs need the same minimum, so one notice covers both: the Themes tab shows it,
// and the disabled Compare tab points at it with aria-describedby.
function NotEnoughSources({
  projectId,
  readyCount,
}: {
  projectId: string;
  readyCount: number;
}) {
  return (
    <Empty id={NOT_ENOUGH_SOURCES_ID}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>
          Compare and Themes need at least {MIN_COMPARED_SOURCES} ready sources
        </EmptyTitle>
        <EmptyDescription>
          {getReadyCountText(readyCount)} A source is ready once it finishes processing.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <SourcesButton projectId={projectId} />
      </EmptyContent>
    </Empty>
  );
}

function ProjectTooLarge({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness: Extract<ThemesReadiness, { kind: 'too-large' }>;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>This project is too large for Themes</EmptyTitle>
        <EmptyDescription>
          Themes reads up to {MAX_THEME_SOURCES} ready sources at once, and this project
          has {readiness.readyCount}. Compare still works on any {MIN_COMPARED_SOURCES} to{' '}
          {MAX_COMPARED_SOURCES} of them, or remove sources until there are{' '}
          {MAX_THEME_SOURCES} or fewer.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <SourcesButton projectId={projectId} />
      </EmptyContent>
    </Empty>
  );
}

function ThemesContent({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness: ThemesReadiness;
}) {
  if (readiness.kind === 'too-few') {
    return <NotEnoughSources projectId={projectId} readyCount={readiness.readyCount} />;
  }

  if (readiness.kind === 'too-large') {
    return <ProjectTooLarge projectId={projectId} readiness={readiness} />;
  }

  return <ThemesPanel projectId={projectId} sourceCount={readiness.sources.length} />;
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
  const themesReadiness = getThemesReadiness(sourcesResult.sources);

  return (
    <>
      <PageHeader
        title="Analysis"
        description="Compare concepts and surface themes across the sources in this project."
      />

      {/* Base UI needs an enabled default when rendering on the server. */}
      <Tabs defaultValue={canCompare ? 'compare' : 'themes'}>
        <TabsList>
          <TabsTrigger
            value="compare"
            disabled={!canCompare}
            aria-describedby={canCompare ? undefined : NOT_ENOUGH_SOURCES_ID}
          >
            <GitCompare />
            Compare
          </TabsTrigger>
          <TabsTrigger value="themes">
            <Layers />
            Themes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="pt-4">
          <ComparePanel projectId={projectId} sources={comparable} />
        </TabsContent>

        <TabsContent value="themes" className="pt-4">
          <ThemesContent projectId={projectId} readiness={themesReadiness} />
        </TabsContent>
      </Tabs>
    </>
  );
}
