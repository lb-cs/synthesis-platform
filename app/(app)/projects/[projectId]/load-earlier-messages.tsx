// No 'use client': only AskPanel (a client component) renders this, so it runs on the
// client already and can take the `onLoaded` callback.
import { ChevronUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useStickToBottomContext } from 'use-stick-to-bottom';

import type { ChatUIMessage } from '@/lib/citations';
import { Button } from '@/components/ui/button';

import { loadEarlierMessages } from './actions';

// "Load earlier messages" at the top of a long chat. Must render inside <Conversation>.
export function LoadEarlierMessages({
  projectId,
  oldestMessageId,
  hasEarlier,
  onLoaded,
}: {
  projectId: string;
  oldestMessageId: string;
  hasEarlier: boolean;
  onLoaded: (messages: ChatUIMessage[], hasEarlier: boolean) => void;
}) {
  const { scrollRef } = useStickToBottomContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set just before a prepend; restoring it keeps the message the reader was on in place.
  const distanceFromBottomRef = useRef<number | null>(null);

  // Runs after the prepended messages are in the DOM, before the browser paints them.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const distanceFromBottom = distanceFromBottomRef.current;

    if (!scroller || distanceFromBottom === null) {
      return;
    }

    distanceFromBottomRef.current = null;
    scroller.scrollTop = scroller.scrollHeight - distanceFromBottom;
  }, [oldestMessageId, scrollRef]);

  async function handleClick() {
    setError(null);
    setIsLoading(true);

    try {
      const result = await loadEarlierMessages(projectId, oldestMessageId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const scroller = scrollRef.current;

      if (scroller) {
        distanceFromBottomRef.current = scroller.scrollHeight - scroller.scrollTop;
      }

      onLoaded(result.messages, result.hasEarlier);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!hasEarlier) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={handleClick}>
        <ChevronUp />
        {isLoading ? 'Loading…' : 'Load earlier messages'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
