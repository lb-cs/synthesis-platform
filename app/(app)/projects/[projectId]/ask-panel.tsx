'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader, MessageSquare, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Textarea } from '@/components/ui/textarea';

import { AnswerText } from './answer-text';

function UserBubble({ text }: { text: string }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
      {text}
    </p>
  );
}

// The workspace chat: streams answers from /api/projects/[id]/chat via the AI SDK.
export function AskPanel({
  projectId,
  initialMessages,
  hasSources,
}: {
  projectId: string;
  initialMessages: ChatUIMessage[];
  hasSources: boolean;
}) {
  const [question, setQuestion] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat<ChatUIMessage>({
    id: projectId,
    messages: initialMessages,
    // The server keeps the history, so each request carries only the new question.
    transport: new DefaultChatTransport({
      api: `/api/projects/${projectId}/chat`,
      prepareSendMessagesRequest: ({ messages: chatMessages }) => {
        const lastMessage = chatMessages[chatMessages.length - 1];

        return { body: { question: getMessageText(lastMessage) } };
      },
    }),
  });

  const isBusy = status === 'submitted' || status === 'streaming';
  const trimmedQuestion = question.trim();
  const canSend = hasSources && !isBusy && trimmedQuestion !== '';
  const placeholder = hasSources
    ? 'What does the literature say about…'
    : 'Add a source to start asking';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    sendMessage({ text: trimmedQuestion });
    setQuestion('');
  }

  // Enter sends; Shift+Enter starts a new line.
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      {/* min-h-0 lets this scroll inside the capped card, keeping the footer at the bottom. */}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle>Ask a question about your sources</EmptyTitle>
              <EmptyDescription>
                Answers cite the numbered sources they draw on.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {messages.map((message) => {
          const text = getMessageText(message);

          if (message.role === 'user') {
            return <UserBubble key={message.id} text={text} />;
          }

          return (
            <AnswerText
              key={message.id}
              projectId={projectId}
              text={text}
              sources={message.metadata?.sources ?? []}
            />
          );
        })}

        {status === 'submitted' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader className="size-4 animate-spin" />
            Reading your sources…
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            Could not get an answer. Check your connection and try again.
          </p>
        )}

        <div ref={bottomRef} />
      </CardContent>

      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full items-end gap-2">
          <Textarea
            aria-label="Question"
            placeholder={placeholder}
            className="max-h-40 min-h-10 flex-1 resize-none"
            rows={1}
            value={question}
            disabled={!hasSources}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isBusy ? (
            <Button type="button" size="icon" aria-label="Stop" onClick={() => stop()}>
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send" disabled={!canSend}>
              <Send />
            </Button>
          )}
        </form>
      </CardFooter>
    </>
  );
}
