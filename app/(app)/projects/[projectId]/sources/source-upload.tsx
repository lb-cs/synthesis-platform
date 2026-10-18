'use client';

import { CircleAlert, CircleCheck, Loader, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { cn } from 'cn';

import { ACCEPTED_FILE_EXTENSIONS } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { uploadSource } from './upload-source';

type UploadState =
  { kind: 'uploading' } | { kind: 'done' } | { kind: 'error'; message: string };

type UploadItem = { id: string; name: string; state: UploadState };

function UploadItemRow({ item }: { item: UploadItem }) {
  if (item.state.kind === 'error') {
    return (
      <li className="flex items-start gap-2 text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="font-medium break-all">{item.name}</span>: {item.state.message}
        </span>
      </li>
    );
  }

  if (item.state.kind === 'done') {
    return (
      <li className="flex items-center gap-2 text-muted-foreground">
        <CircleCheck className="size-4 shrink-0" />
        <span className="truncate">{item.name} added</span>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      <Loader className="size-4 shrink-0 animate-spin" />
      <span className="truncate">Uploading {item.name}…</span>
    </li>
  );
}

export function SourceUpload({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function setItemState(id: string, state: UploadState) {
    setItems((current) => {
      return current.map((item) => (item.id === id ? { ...item, state } : item));
    });
  }

  async function uploadOne(item: UploadItem, file: File) {
    try {
      const result = await uploadSource(userId, projectId, file);

      if (!result.ok) {
        setItemState(item.id, { kind: 'error', message: result.message });
        return;
      }

      setItemState(item.id, { kind: 'done' });
    } catch {
      // fetch rejects only on network-level failures (offline, DNS, refused).
      setItemState(item.id, {
        kind: 'error',
        message: 'Could not reach the server. Check your connection.',
      });
    }
  }

  // One at a time, so a large batch doesn't open dozens of uploads at once.
  async function uploadFiles(files: File[]) {
    if (files.length === 0 || isUploading) {
      return;
    }

    const newItems: UploadItem[] = files.map((file) => {
      return { id: crypto.randomUUID(), name: file.name, state: { kind: 'uploading' } };
    });

    setItems(newItems);
    setIsUploading(true);

    for (const [index, file] of files.entries()) {
      await uploadOne(newItems[index], file);
    }

    setIsUploading(false);
    router.refresh();
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    // Clear it so picking the same file again still fires a change.
    event.target.value = '';
    void uploadFiles(files);
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    // Moving onto a child element still counts as inside the drop zone.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <Card
      className={cn('border-dashed', isDragging && 'border-primary bg-muted')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Upload className="size-6 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Drop PDF or text files here</p>
          <p className="text-sm text-muted-foreground">
            PDF, .txt, or .md, up to 50 MB each. Files are queued for processing.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_EXTENSIONS}
          className="hidden"
          onChange={onInputChange}
        />
        <Button
          variant="secondary"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? 'Uploading…' : 'Browse files'}
        </Button>
        {items.length > 0 && (
          <ul aria-live="polite" className="flex w-full max-w-md flex-col gap-1 text-sm">
            {items.map((item) => (
              <UploadItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
