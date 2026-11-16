import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

import type { ChatUIMessage } from '@/lib/citations';
import { getMessageText } from '@/lib/citations';
import { Shimmer } from '@/components/ai-elements/shimmer';
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

import { AnswerText } from '../answer-text';

/** The workspace's split: sources on the left, the task's result on the right. */
export function AnalysisLayout({
  sourcesTitle,
  sourcesDescription,
  sources,
  children,
}: {
  sourcesTitle: string;
  sourcesDescription: string;
  sources: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>{sourcesTitle}</CardTitle>
          <CardDescription>{sourcesDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">{sources}</CardContent>
      </Card>

      {/* Capped so a long result scrolls inside the card, keeping the footer in view. */}
      <Card className="flex max-h-[70svh] min-h-96 flex-col lg:max-h-[calc(100svh-14rem)]">
        {children}
      </Card>
    </div>
  );
}

type AnalysisRun = {
  heading: string;
  message: ChatUIMessage | undefined;
  isBusy: boolean;
  isStreaming: boolean;
  errorMessage: string | null;
  onRetry: () => void;
};

/** The right-hand card: an empty state until a run starts, then its streamed result. */
export function AnalysisResult({
  projectId,
  title,
  description,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  run,
  footer,
}: {
  projectId: string;
  title: string;
  description: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  run: AnalysisRun | null;
  footer?: ReactNode;
}) {
  const header = (
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );

  if (!run) {
    return (
      <>
        {header}
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">{emptyIcon}</EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
          {emptyAction}
        </Empty>
        {footer && <CardFooter className="flex-col items-stretch">{footer}</CardFooter>}
      </>
    );
  }

  const text = run.message ? getMessageText(run.message) : '';
  const isWaiting = run.isBusy && text === '';

  return (
    <>
      {header}
      {/* min-h-0 lets the result scroll inside the capped card. */}
      <CardContent
        aria-live="polite"
        aria-busy={run.isBusy}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm"
      >
        <h3 className="font-medium">{run.heading}</h3>

        {isWaiting && <Shimmer>Reading your sources…</Shimmer>}

        {run.message && text !== '' && (
          <AnswerText
            projectId={projectId}
            text={text}
            sources={run.message.metadata?.sources ?? []}
            isStreaming={run.isStreaming}
          />
        )}

        {run.errorMessage && (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-destructive">{run.errorMessage}</p>
            <Button variant="outline" size="sm" onClick={run.onRetry}>
              <RotateCcw />
              Try again
            </Button>
          </div>
        )}
      </CardContent>
      {footer && <CardFooter className="flex-col items-stretch">{footer}</CardFooter>}
    </>
  );
}
