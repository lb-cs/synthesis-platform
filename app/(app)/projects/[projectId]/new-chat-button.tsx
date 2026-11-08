// No 'use client': only AskPanel (a client component) renders this, so it runs on the
// client already and can take the `onCleared` callback.
import { SquarePen } from 'lucide-react';
import { useState, useTransition } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { startNewChat } from './actions';

// "New chat" in the Ask card's header. Confirms first: clearing can't be undone.
export function NewChatButton({
  projectId,
  disabled,
  onCleared,
}: {
  projectId: string;
  disabled: boolean;
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    // Stay open until the delete finishes, so a failure has somewhere to show.
    if (isClearing) {
      return;
    }

    setError(null);
    setOpen(nextOpen);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startNewChat(projectId);

        if (result.error) {
          setError(result.error);
          return;
        }

        onCleared();
        setOpen(false);
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="ghost" size="sm" />}
      >
        <SquarePen />
        New chat
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears the current conversation. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isClearing} onClick={handleConfirm}>
            {isClearing ? 'Clearing…' : 'Start new chat'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
