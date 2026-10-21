import type { Metadata } from 'next';
import { CircleAlert, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { projectIdSchema } from '@/app/api/projects/schema';
import { PageHeader } from '@/components/page-header';
import { listRecentChatMessages, toChatUIMessage } from '@/lib/chat';
import { numberSources, toCitedSources } from '@/lib/citations';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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

import { AskPanel } from './ask-panel';
import { WorkspaceSources } from './workspace-sources';

// How much of the conversation the page shows on load.
const VISIBLE_MESSAGE_LIMIT = 50;

function LoadError() {
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
    return <LoadError />;
  }

  const [sourcesResult, messagesResult] = await Promise.all([
    listSources(supabase, projectId),
    listRecentChatMessages(supabase, projectId, VISIBLE_MESSAGE_LIMIT),
  ]);

  if (!sourcesResult.ok || !messagesResult.ok) {
    return <LoadError />;
  }

  const { project } = result;
  const numberedSources = numberSources(sourcesResult.sources);
  const citedSources = toCitedSources(numberedSources);
  const initialMessages = messagesResult.messages.map((message) => {
    return toChatUIMessage(message, citedSources);
  });
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
            <WorkspaceSources projectId={projectId} sources={numberedSources} />
          </CardContent>
        </Card>

        {/* Capped so a long chat scrolls inside the card instead of pushing the input down. */}
        <Card className="flex max-h-[70svh] min-h-96 flex-col lg:max-h-[calc(100svh-10rem)]">
          <CardHeader>
            <CardTitle>Ask</CardTitle>
            <CardDescription>Answers come with citations you can open.</CardDescription>
          </CardHeader>
          <AskPanel
            projectId={projectId}
            initialMessages={initialMessages}
            hasSources={numberedSources.length > 0}
          />
        </Card>
      </div>
    </>
  );
}
