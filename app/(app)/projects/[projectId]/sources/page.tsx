import type { Metadata } from 'next';
import { CircleAlert, Link2, Upload } from 'lucide-react';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { getProject } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { loadSources } from './load-sources';
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
  const projectResult = await getProject(supabase, projectId);

  // RLS hides other users' projects, so theirs land here too.
  if (!projectResult.ok && projectResult.kind === 'not-found') {
    notFound();
  }

  if (!projectResult.ok) {
    return <LoadError />;
  }

  const sourcesResult = await loadSources(supabase, projectId);

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

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Upload className="size-6 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Drop PDF or text files here</p>
            <p className="text-sm text-muted-foreground">
              Files are stored, parsed, and queued for processing.
            </p>
          </div>
          {/* Not wired up: upload lands with CECS491-10. */}
          <Button variant="secondary" disabled>
            Browse files
          </Button>
        </CardContent>
      </Card>

      <SourcesList sources={sourcesResult.sources} />
    </>
  );
}
