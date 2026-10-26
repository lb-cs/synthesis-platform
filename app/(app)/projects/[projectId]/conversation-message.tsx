'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { getMessageText, type ChatUIMessage } from '@/lib/citations';
import { cn } from '@/lib/utils';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from '@/components/ai-elements/message';

import { AnswerText } from './answer-text';

// How long the copy button shows its check mark.
const COPIED_RESET_MS = 2000;

export const ENTER_ANIMATION = 'animate-in duration-300 fade-in-0 slide-in-from-bottom-2';

function CopyAnswerButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    // Rejects when the browser denies clipboard access; the button just stays as it was.
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
  }

  return (
    <MessageAction
      tooltip={isCopied ? 'Copied' : 'Copy answer'}
      className="text-muted-foreground"
      onClick={handleCopy}
    >
      {isCopied ? <Check /> : <Copy />}
    </MessageAction>
  );
}

// One turn in the workspace chat: the question as a bubble, the answer as cited prose.
export function ConversationMessage({
  projectId,
  message,
  isNew,
  isStreaming,
}: {
  projectId: string;
  message: ChatUIMessage;
  isNew: boolean;
  isStreaming: boolean;
}) {
  const text = getMessageText(message);

  if (message.role === 'user') {
    return (
      <Message from="user" className={cn(isNew && ENTER_ANIMATION)}>
        <MessageContent>
          <p className="whitespace-pre-wrap">{text}</p>
        </MessageContent>
      </Message>
    );
  }

  // The panel's shimmer stands in until the first word arrives.
  if (text === '') {
    return null;
  }

  return (
    <Message from="assistant">
      <MessageContent>
        <AnswerText
          projectId={projectId}
          text={text}
          sources={message.metadata?.sources ?? []}
          isStreaming={isStreaming}
        />
      </MessageContent>
      {!isStreaming && (
        <MessageActions className="-ml-1.5 animate-in duration-300 fade-in-0">
          <CopyAnswerButton text={text} />
        </MessageActions>
      )}
    </Message>
  );
}
