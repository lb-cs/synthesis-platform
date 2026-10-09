import { FileText } from 'lucide-react';

import type { Source } from '@/lib/sources';

import { formatAddedDate } from './format-source';
import { SourceStatusBadge } from './source-status-badge';
import { KIND_LABELS } from './source-types';

export function SourceRow({
  source,
  onSelect,
}: {
  source: Source;
  onSelect: (sourceId: string) => void;
}) {
  const failureReason = source.processingError ?? 'Processing failed.';

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(source.id)}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{source.title}</span>
          </span>
          <SourceStatusBadge status={source.status} />
        </span>
        <span className="text-sm text-muted-foreground">
          {KIND_LABELS[source.kind]} · Added {formatAddedDate(source.createdAt)}
        </span>
        {source.status === 'failed' && (
          <span className="line-clamp-2 text-sm text-destructive">{failureReason}</span>
        )}
      </button>
    </li>
  );
}
