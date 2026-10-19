'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

import { removeAccount } from './actions';

export function DeleteAccountButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startTransition] = useTransition();

  function onDelete() {
    const confirmed = window.confirm(
      'Delete your account? All your projects, sources, chat history and uploaded files will be permanently deleted. This cannot be undone.',
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await removeAccount();

        if (result.error) {
          setError(result.error);
          return;
        }

        router.replace('/home');
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={isDeleting}
        onClick={onDelete}
      >
        {isDeleting ? 'Deleting…' : 'Delete account'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
