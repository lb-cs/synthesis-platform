'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, GitCompare, Square } from 'lucide-react';
import { useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import {
  MAX_COMPARED_SOURCES,
  MAX_TOPIC_LENGTH,
  MIN_COMPARED_SOURCES,
  type ComparableSource,
} from '@/lib/comparison';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

import { AnalysisLayout, AnalysisResult } from './analysis-layout';
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
  const hasEnoughSources = selectedIds.length >= MIN_COMPARED_SOURCES;
  const canCompare = !isBusy && trimmedTopic !== '' && hasEnoughSources;

  const message = messages.find((item) => item.role === 'assistant');
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

  const run = lastRequest
    ? {
        heading: `${joinTitles(comparedTitles)} on “${lastRequest.topic}”`,
        message,
        isBusy,
        isStreaming: status === 'streaming',
        errorMessage: error ? getRequestErrorMessage(error, DEFAULT_ERROR) : null,
        onRetry: () => runComparison(lastRequest),
      }
    : null;

  const emptyDescription = `Tick ${MIN_COMPARED_SOURCES} to ${MAX_COMPARED_SOURCES} sources on the left, then type a topic below. The comparison uses only what those sources say about it.`;

  return (
    <AnalysisLayout
      sourcesTitle="Sources"
      sourcesDescription={`Pick ${MIN_COMPARED_SOURCES} to ${MAX_COMPARED_SOURCES} to compare. ${selectedIds.length} selected.`}
      sources={
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
      }
    >
      <AnalysisResult
        projectId={projectId}
        title="Compare"
        description="Where your chosen sources agree, differ, and why."
        emptyIcon={<GitCompare />}
        emptyTitle="Compare sources on a topic"
        emptyDescription={emptyDescription}
        run={run}
        footer={
          <form onSubmit={handleSubmit}>
            <InputGroup className="bg-background">
              <InputGroupInput
                aria-label="Topic"
                placeholder={
                  hasEnoughSources
                    ? 'Topic, e.g. how each study measures sleep quality'
                    : `Pick at least ${MIN_COMPARED_SOURCES} sources first`
                }
                maxLength={MAX_TOPIC_LENGTH}
                value={topic}
                disabled={isBusy || !hasEnoughSources}
                onChange={(event) => setTopic(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                {isBusy ? (
                  <InputGroupButton
                    size="icon-sm"
                    variant="default"
                    className="rounded-full"
                    aria-label="Stop comparing"
                    onClick={() => stop()}
                  >
                    <Square className="fill-current" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    size="icon-sm"
                    variant="default"
                    className="rounded-full"
                    aria-label="Compare"
                    disabled={!canCompare}
                  >
                    <ArrowUp />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
          </form>
        }
      />
    </AnalysisLayout>
  );
}
