'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FileText, Layers, Square } from 'lucide-react';

import type { ChatUIMessage } from '@/lib/citations';
import type { PassageSource } from '@/lib/passages';
import { PASSAGES_PER_SOURCE } from '@/lib/themes';
import { Button } from '@/components/ui/button';

import { AnalysisLayout, AnalysisResult } from './analysis-layout';
import { getRequestErrorMessage } from './request-error';

const DEFAULT_ERROR = 'Could not find themes. Check your connection and try again.';

// The route reads the project itself, so the request carries nothing but the trigger.
const FIND_THEMES_TEXT = 'Find the key themes across my sources.';

// UC-19: one button streams the key themes across every ready source, with evidence.
export function ThemesPanel({
  projectId,
  sources,
}: {
  projectId: string;
  sources: PassageSource[];
}) {
  const { messages, sendMessage, setMessages, status, stop, error } =
    useChat<ChatUIMessage>({
      id: `themes-${projectId}`,
      throttle: 50,
      transport: new DefaultChatTransport({
        api: `/api/projects/${projectId}/themes`,
        prepareSendMessagesRequest: () => {
          return { body: {} };
        },
      }),
    });

  const isBusy = status === 'submitted' || status === 'streaming';
  const hasRun = messages.length > 0;
  const message = messages.find((item) => item.role === 'assistant');

  function findThemes() {
    // One run at a time: a new run replaces the last result.
    setMessages([]);
    sendMessage({ text: FIND_THEMES_TEXT });
  }

  const findButton = isBusy ? (
    <Button type="button" variant="outline" onClick={() => stop()}>
      <Square className="fill-current" />
      Stop
    </Button>
  ) : (
    <Button type="button" onClick={findThemes}>
      <Layers />
      {hasRun ? 'Find themes again' : 'Find themes'}
    </Button>
  );

  const run = hasRun
    ? {
        heading: `Key themes across ${sources.length} sources`,
        message,
        isBusy,
        isStreaming: status === 'streaming',
        errorMessage: error ? getRequestErrorMessage(error, DEFAULT_ERROR) : null,
        onRetry: findThemes,
      }
    : null;

  return (
    <AnalysisLayout
      sourcesTitle="Sources"
      sourcesDescription="Themes reads every ready source."
      sources={
        <ol className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={source.id} className="flex items-center gap-2 px-2 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{source.title}</span>
            </li>
          ))}
        </ol>
      }
    >
      <AnalysisResult
        projectId={projectId}
        title="Themes"
        description="The ideas your sources share, with the evidence for each."
        emptyIcon={<Layers />}
        emptyTitle="Find the key themes"
        emptyDescription={`Reads up to ${PASSAGES_PER_SOURCE} passages spread through each of your ${sources.length} ready sources and finds the themes they share.`}
        run={run}
        footer={<div className="flex justify-end">{findButton}</div>}
      />
    </AnalysisLayout>
  );
}
