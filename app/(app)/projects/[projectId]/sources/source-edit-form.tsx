import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { Source } from '@/lib/sources';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { removeSource, retryFailedSource } from './actions';

const TITLE_MAX_LENGTH = 200;

/** Rename goes through the PATCH route; remove through the server action. */
export function SourceEditForm({
  projectId,
  source,
  onRemoved,
}: {
  projectId: string;
  source: Source;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(source.title);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, startRetryTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();

  const trimmedTitle = title.trim();
  const isBusy = isSaving || isRetrying || isRemoving;
  const canSave = trimmedTitle.length > 0 && trimmedTitle !== source.title && !isBusy;

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));

        setError(body.error ?? 'Could not rename the source. Try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setIsSaving(false);
    }
  }

  function onRetry() {
    setError(null);
    startRetryTransition(async () => {
      const result = await retryFailedSource({ projectId, sourceId: source.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  function onRemove() {
    const confirmed = window.confirm(
      `Remove "${source.title}"? Its file is deleted too. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    startRemoveTransition(async () => {
      const result = await removeSource({ projectId, sourceId: source.id });

      if (result.error) {
        setError(result.error);
        return;
      }

      onRemoved();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 px-4">
      <Field data-invalid={error !== null}>
        <FieldLabel htmlFor="source-title">Title</FieldLabel>
        <Input
          id="source-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
        {error && <FieldError errors={[{ message: error }]} />}
      </Field>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {source.status === 'failed' && (
            <Button type="button" variant="outline" disabled={isBusy} onClick={onRetry}>
              {isRetrying ? 'Retrying…' : 'Retry processing'}
            </Button>
          )}
          <Button type="button" variant="destructive" disabled={isBusy} onClick={onRemove}>
            {isRemoving ? 'Removing…' : 'Remove source'}
          </Button>
        </div>
        <Button type="submit" disabled={!canSave}>
          {isSaving ? 'Saving…' : 'Save title'}
        </Button>
      </div>
    </form>
  );
}
