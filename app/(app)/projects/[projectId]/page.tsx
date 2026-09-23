import type { Metadata } from 'next';
import { CircleAlert, FileText, MessageSquare, Plus, Send } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { PageHeader } from '@/components/page-header';
import { getProject } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Textarea } from '@/components/ui/textarea';

export const metadata: Metadata = {
  title: 'Workspace · Synthesis Platform',
};

// The split-panel screen from the wireframes: sources on one side, the AI chat on the other.
export default async function WorkspacePage({
  params,
}: PageProps<'/projects/[projectId]'>) {
  const { projectId } = await params;

  // A malformed id can't match a row, and Postgres would reject it as a uuid anyway.
  if (!projectIdSchema.safeParse(projectId).success) {
    notFound();
  }

  const supabase = await createClient();
  const result = await getProject(supabase, projectId);

  // RLS hides other users' projects, so theirs land here too.
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
          <EmptyTitle>Could not load this project</EmptyTitle>
          <EmptyDescription>Refresh the page to try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { project } = result;
  const description =
    project.description ??
    "Ask questions and get answers grounded in this project's sources.";

  return (
    <>
      <PageHeader title={project.title} description={description}>
        <Button
          variant="outline"
          render={<Link href={`/projects/${projectId}/sources`} />}
          nativeButton={false}
        >
          <Plus />
          Add source
        </Button>
      </PageHeader>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Everything the answers can cite.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No sources yet</EmptyTitle>
                <EmptyDescription>
                  Upload PDFs or text files to give the AI something to work with.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Ask</CardTitle>
            <CardDescription>Answers come with citations you can open.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquare />
                </EmptyMedia>
                <EmptyTitle>Ask a question about your sources</EmptyTitle>
                <EmptyDescription>
                  The conversation will appear here once sources are processed.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
          <CardFooter className="gap-2">
            {/* Not wired up: streaming Q&A lands with CECS491-14. */}
            <Textarea
              aria-label="Question"
              placeholder="What does the literature say about…"
              className="min-h-10 flex-1 resize-none"
              rows={1}
            />
            <Button size="icon" aria-label="Send" disabled>
              <Send />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
