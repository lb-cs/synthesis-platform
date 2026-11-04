'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Layers, RotateCcw, Square } from 'lucide-react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import { PASSAGES_PER_SOURCE } from '@/lib/themes';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AnswerText } from '../answer-text';
import { getRequestErrorMessage } from './request-error';

const DEFAULT_ERROR = 'Could not find themes. Check your connection and try again.';

// The route reads the project itself, so the request carries nothing but the trigger.
const FIND_THEMES_TEXT = 'Find the key themes across my sources.';

// UC-19: one button streams the key themes across every ready source, with evidence.
export function ThemesPanel({
  projectId,
  sourceCount,
}: {
  projectId: string;
  sourceCount: number;
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
  const result = messages.find((message) => message.role === 'assistant');
  const resultText = result ? getMessageText(result) : '';
  const isWaiting = isBusy && resultText === '';
  const hasRun = messages.length > 0;

  function findThemes() {
    // One run at a time: a new run replaces the last result.
    setMessages([]);
    sendMessage({ text: FIND_THEMES_TEXT });
  }

  return (
    // Capped so the themes keep a readable line length, like the Compare tab.
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          Reads up to {PASSAGES_PER_SOURCE} passages spread through each of your{' '}
          {sourceCount} ready sources and finds the themes they share, with the evidence
          for each.
        </p>
        {isBusy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            <Square className="fill-current" />
            Stop
          </Button>
        ) : (
          <Button type="button" onClick={findThemes}>
            <Layers />
            {hasRun ? 'Find themes again' : 'Find themes'}
          </Button>
        )}
      </div>

      {hasRun && (
        <Card aria-live="polite" aria-busy={isBusy}>
          <CardHeader>
            <CardTitle className="text-base">
              Key themes across {sourceCount} sources
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
                <Button variant="outline" size="sm" onClick={findThemes}>
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
