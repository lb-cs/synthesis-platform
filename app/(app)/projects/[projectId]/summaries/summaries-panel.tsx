'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { BookOpen, Square } from 'lucide-react';
import { useState } from 'react';

import type { ChatUIMessage } from '@/lib/citations';
import {
  MAX_SUMMARIZED_SOURCES,
  MIN_SUMMARIZED_SOURCES,
  PASSAGES_PER_SOURCE,
  type SummarizableSource,
} from '@/lib/summaries';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';

import { AnalysisLayout, AnalysisResult } from '../analysis/analysis-layout';
import { getRequestErrorMessage } from '../analysis/request-error';

const DEFAULT_ERROR =
  'Could not summarize your sources. Check your connection and try again.';

// The chosen sources travel in the request body; the message text is only the trigger.
const SUMMARIZE_TEXT = 'Summarize my selected sources.';

// One title for a single source, a count for several: the summary names each one itself.
function getSummaryTitle(titles: string[]): string {
  if (titles.length === 1) {
    return `Summary of “${titles[0]}”`;
  }

  return `Summary of ${titles.length} sources`;
}

// UC-17: pick sources, then stream a cited summary of them from /summaries.
export function SummariesPanel({
  projectId,
  sources,
}: {
  projectId: string;
  sources: SummarizableSource[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSourceIds, setLastSourceIds] = useState<string[] | null>(null);

  const { messages, sendMessage, setMessages, status, stop, error } =
    useChat<ChatUIMessage>({
      id: `summaries-${projectId}`,
      throttle: 50,
      transport: new DefaultChatTransport({
        api: `/api/projects/${projectId}/summaries`,
        prepareSendMessagesRequest: ({ body }) => {
          return { body: { sourceIds: body?.sourceIds } };
        },
      }),
    });

  const isBusy = status === 'submitted' || status === 'streaming';
  const isFull = selectedIds.length >= MAX_SUMMARIZED_SOURCES;
  const canSummarize = !isBusy && selectedIds.length >= MIN_SUMMARIZED_SOURCES;

  const message = messages.find((item) => item.role === 'assistant');
  const titleById = new Map(sources.map((source) => [source.id, source.title]));
  const summarizedTitles = (lastSourceIds ?? []).flatMap((id) => {
    const title = titleById.get(id);

    return title ? [title] : [];
  });

  function toggleSource(sourceId: string, isChecked: boolean) {
    setSelectedIds((current) => {
      if (!isChecked) {
        return current.filter((id) => id !== sourceId);
      }

      return [...current, sourceId];
    });
  }

  function runSummary(sourceIds: string[]) {
    // One summary at a time: a new run replaces the last result.
    setMessages([]);
    setLastSourceIds(sourceIds);
    sendMessage({ text: SUMMARIZE_TEXT }, { body: { sourceIds } });
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSummarize) {
      return;
    }

    runSummary(selectedIds);
  }

  const summarizeButton = isBusy ? (
    // Keys give each button its own element. Without them React reuses one and flips it
    // from button to submit mid-click, so Stop would submit the form.
    <Button key="stop" type="button" variant="outline" onClick={() => stop()}>
      <Square className="fill-current" />
      Stop
    </Button>
  ) : (
    <Button key="summarize" type="submit" disabled={!canSummarize}>
      <BookOpen />
      {lastSourceIds ? 'Summarize again' : 'Summarize'}
    </Button>
  );

  const run = lastSourceIds
    ? {
        heading: getSummaryTitle(summarizedTitles),
        message,
        isBusy,
        isStreaming: status === 'streaming',
        errorMessage: error ? getRequestErrorMessage(error, DEFAULT_ERROR) : null,
        onRetry: () => runSummary(lastSourceIds),
      }
    : null;

  return (
    <AnalysisLayout
      hasTabs={false}
      sourcesTitle="Sources"
      sourcesDescription={`Pick ${MIN_SUMMARIZED_SOURCES} to ${MAX_SUMMARIZED_SOURCES} to summarize. ${selectedIds.length} selected.`}
      sources={
        <FieldGroup className="gap-3">
          {sources.map((source) => {
            const isChecked = selectedIds.includes(source.id);
            const checkboxId = `summary-source-${source.id}`;

            return (
              <Field key={source.id} orientation="horizontal">
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  disabled={isBusy || (isFull && !isChecked)}
                  onCheckedChange={(checked) => toggleSource(source.id, checked)}
                />
                <FieldLabel htmlFor={checkboxId} className="font-normal">
                  {source.title}
                </FieldLabel>
              </Field>
            );
          })}
        </FieldGroup>
      }
    >
      <AnalysisResult
        projectId={projectId}
        title="Summary"
        description="A structured summary of your chosen sources, with citations."
        emptyIcon={<BookOpen />}
        emptyTitle="Summarize your sources"
        emptyDescription={`Tick ${MIN_SUMMARIZED_SOURCES} to ${MAX_SUMMARIZED_SOURCES} sources on the left, then press Summarize. Reads up to ${PASSAGES_PER_SOURCE} passages spread through each.`}
        run={run}
        footer={
          <form onSubmit={handleSubmit} className="flex justify-end">
            {summarizeButton}
          </form>
        }
      />
    </AnalysisLayout>
  );
}
