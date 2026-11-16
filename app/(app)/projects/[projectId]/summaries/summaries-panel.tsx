'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { BookOpen, RotateCcw, Square } from 'lucide-react';
import { useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import {
  MAX_SUMMARIZED_SOURCES,
  MIN_SUMMARIZED_SOURCES,
  PASSAGES_PER_SOURCE,
  type SummarizableSource,
} from '@/lib/summaries';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';

import { getRequestErrorMessage } from '../analysis/request-error';
import { AnswerText } from '../answer-text';

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

  const result = messages.find((message) => message.role === 'assistant');
  const resultText = result ? getMessageText(result) : '';
  const isWaiting = isBusy && resultText === '';
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

  return (
    // Capped so the summary keeps a readable line length, like the Analysis tabs.
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Sources to summarize</FieldLegend>
            <FieldDescription>
              Pick {MIN_SUMMARIZED_SOURCES} to {MAX_SUMMARIZED_SOURCES} ready sources.{' '}
              {selectedIds.length} selected.
              {selectedIds.length > 0 &&
                ` Reads up to ${PASSAGES_PER_SOURCE} passages spread through each.`}
            </FieldDescription>
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
          </FieldSet>

          <div>
            {/* Keys give each button its own element. Without them React reuses one and
                flips it from button to submit mid-click, so Stop would submit the form. */}
            {isBusy ? (
              <Button key="stop" type="button" variant="outline" onClick={() => stop()}>
                <Square className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button key="summarize" type="submit" disabled={!canSummarize}>
                <BookOpen />
                Summarize
              </Button>
            )}
          </div>
        </FieldGroup>
      </form>

      {lastSourceIds && (
        <Card aria-live="polite" aria-busy={isBusy}>
          <CardHeader>
            <CardTitle className="text-base">
              {getSummaryTitle(summarizedTitles)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {isWaiting && <Shimmer>Reading your sources…</Shimmer>}

            {result && resultText !== '' && (
              <AnswerText
                projectId={projectId}
                text={resultText}
                sources={result.metadata?.sources ?? []}
                isStreaming={status === 'streaming'}
              />
            )}

            {error && (
              <div role="alert" className="flex flex-wrap items-center gap-3">
                <p className="text-destructive">
                  {getRequestErrorMessage(error, DEFAULT_ERROR)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runSummary(lastSourceIds)}
                >
                  <RotateCcw />
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
