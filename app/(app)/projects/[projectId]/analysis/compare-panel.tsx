'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { GitCompare, RotateCcw, Square } from 'lucide-react';
import { useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import {
  MAX_COMPARED_SOURCES,
  MAX_TOPIC_LENGTH,
  MIN_COMPARED_SOURCES,
  type ComparableSource,
} from '@/lib/comparison';
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
import { Input } from '@/components/ui/input';

import { AnswerText } from '../answer-text';
import { getRequestErrorMessage } from './request-error';

const DEFAULT_ERROR =
  'Could not compare your sources. Check your connection and try again.';

type CompareRequest = {
  topic: string;
  sourceIds: string[];
};

function joinTitles(titles: string[]): string {
  if (titles.length <= 2) {
    return titles.join(' and ');
  }

  return `${titles.slice(0, -1).join(', ')}, and ${titles.at(-1)}`;
}

// UC-18: pick sources and a topic, then stream a cited comparison from /compare.
export function ComparePanel({
  projectId,
  sources,
}: {
  projectId: string;
  sources: ComparableSource[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [lastRequest, setLastRequest] = useState<CompareRequest | null>(null);

  const { messages, sendMessage, setMessages, status, stop, error } =
    useChat<ChatUIMessage>({
      id: `compare-${projectId}`,
      throttle: 50,
      transport: new DefaultChatTransport({
        api: `/api/projects/${projectId}/compare`,
        // The topic travels as the message text, the chosen sources in the request body.
        prepareSendMessagesRequest: ({ messages: requestMessages, body }) => {
          const lastMessage = requestMessages[requestMessages.length - 1];

          return {
            body: { topic: getMessageText(lastMessage), sourceIds: body?.sourceIds },
          };
        },
      }),
    });

  const isBusy = status === 'submitted' || status === 'streaming';
  const trimmedTopic = topic.trim();
  const isFull = selectedIds.length >= MAX_COMPARED_SOURCES;
  const canCompare =
    !isBusy && trimmedTopic !== '' && selectedIds.length >= MIN_COMPARED_SOURCES;

  const result = messages.find((message) => message.role === 'assistant');
  const resultText = result ? getMessageText(result) : '';
  const isWaiting = isBusy && resultText === '';
  const titleById = new Map(sources.map((source) => [source.id, source.title]));
  const comparedTitles = (lastRequest?.sourceIds ?? []).flatMap((id) => {
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

  function runComparison(request: CompareRequest) {
    // One comparison at a time: a new run replaces the last result.
    setMessages([]);
    setLastRequest(request);
    sendMessage({ text: request.topic }, { body: { sourceIds: request.sourceIds } });
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCompare) {
      return;
    }

    runComparison({ topic: trimmedTopic, sourceIds: selectedIds });
  }

  return (
    // Capped so the topic field and the comparison keep a readable line length.
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Sources to compare</FieldLegend>
            <FieldDescription>
              Pick {MIN_COMPARED_SOURCES} to {MAX_COMPARED_SOURCES} ready sources.{' '}
              {selectedIds.length} selected.
            </FieldDescription>
            <FieldGroup className="gap-3">
              {sources.map((source) => {
                const isChecked = selectedIds.includes(source.id);
                const checkboxId = `compare-source-${source.id}`;

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

          <Field>
            <FieldLabel htmlFor="compare-topic">Topic</FieldLabel>
            <Input
              id="compare-topic"
              placeholder="e.g. how each study measures sleep quality"
              maxLength={MAX_TOPIC_LENGTH}
              value={topic}
              disabled={isBusy}
              onChange={(event) => setTopic(event.target.value)}
            />
            <FieldDescription>
              The comparison uses only what these sources say about it.
            </FieldDescription>
          </Field>

          <div>
            {isBusy ? (
              <Button type="button" variant="outline" onClick={() => stop()}>
                <Square className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!canCompare}>
                <GitCompare />
                Compare
              </Button>
            )}
          </div>
        </FieldGroup>
      </form>

      {lastRequest && (
        <Card aria-live="polite" aria-busy={isBusy}>
          <CardHeader>
            <CardTitle className="text-base">
              {joinTitles(comparedTitles)} on “{lastRequest.topic}”
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
                  onClick={() => runComparison(lastRequest)}
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
