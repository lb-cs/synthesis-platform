'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, MessageSquare, RotateCcw, Square } from 'lucide-react';
import { useRef, useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import { cn } from '@/lib/utils';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Button } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';

import { ConversationMessage, ENTER_ANIMATION } from './conversation-message';

const STARTER_QUESTIONS = [
  'Summarize the main findings',
  'Where do my sources disagree?',
  'What methods do the studies use?',
];

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
  // Only messages sent in this visit animate in; the loaded history just appears.
  const [loadedIds] = useState(
    () => new Set(initialMessages.map((message) => message.id)),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, regenerate, status, stop, error } =
    useChat<ChatUIMessage>({
      id: projectId,
      messages: initialMessages,
      // Batches token updates so a long answer doesn't re-render on every chunk.
      throttle: 50,
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

  const lastMessage = messages.at(-1);
  const streamingAnswer =
    status === 'streaming' && lastMessage?.role === 'assistant' ? lastMessage : null;
  // The answer message exists before its first word does; keep the shimmer up until then.
  const isWaitingForAnswer =
    status === 'submitted' ||
    (streamingAnswer !== null && getMessageText(streamingAnswer) === '');
  const hasConversation = messages.length > 0;

  function sendQuestion(text: string) {
    sendMessage({ text });
    setQuestion('');
    textareaRef.current?.focus();
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    sendQuestion(trimmedQuestion);
  }

  function handleSuggestion(suggestion: string) {
    if (!hasSources || isBusy) {
      return;
    }

    sendQuestion(suggestion);
  }

  // Enter sends, Shift+Enter starts a new line, Escape stops an answer mid-stream.
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape' && isBusy) {
      event.preventDefault();
      stop();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      {!hasConversation && (
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

      {hasConversation && (
        // min-h-0 lets the log scroll inside the capped card, keeping the input at the bottom.
        <Conversation className="min-h-0" aria-label="Conversation">
          <ConversationContent className="pt-0">
            {messages.map((message) => (
              <ConversationMessage
                key={message.id}
                projectId={projectId}
                message={message}
                isNew={!loadedIds.has(message.id)}
                isStreaming={message.id === streamingAnswer?.id}
              />
            ))}

            {isWaitingForAnswer && (
              <Message from="assistant" className={ENTER_ANIMATION}>
                <MessageContent>
                  <Shimmer>Reading your sources…</Shimmer>
                </MessageContent>
              </Message>
            )}

            {error && (
              <div
                role="alert"
                className={cn(
                  'flex flex-wrap items-center gap-3 text-sm',
                  ENTER_ANIMATION,
                )}
              >
                <p className="text-destructive">
                  Could not get an answer. Check your connection and try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => regenerate()}>
                  <RotateCcw />
                  Try again
                </Button>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest message" />
        </Conversation>
      )}

      <CardFooter className="flex-col items-stretch gap-3">
        {!hasConversation && hasSources && (
          <Suggestions>
            {STARTER_QUESTIONS.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestion}
              />
            ))}
          </Suggestions>
        )}

        <form onSubmit={handleSubmit}>
          <InputGroup className="bg-background">
            <InputGroupTextarea
              ref={textareaRef}
              aria-label="Question"
              placeholder={placeholder}
              className="max-h-40 min-h-12"
              value={question}
              disabled={!hasSources}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <InputGroupAddon align="block-end">
              <InputGroupText className="hidden text-xs sm:flex">
                {isBusy ? 'Esc to stop' : 'Enter to send · Shift+Enter for a new line'}
              </InputGroupText>
              {isBusy ? (
                <InputGroupButton
                  size="icon-sm"
                  variant="default"
                  className="ml-auto rounded-full"
                  aria-label="Stop answering"
                  onClick={() => stop()}
                >
                  <Square className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ml-auto rounded-full"
                  aria-label="Send"
                  disabled={!canSend}
                >
                  <ArrowUp />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
      </CardFooter>
    </>
  );
}
