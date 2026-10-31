import { FileText } from 'lucide-react';

import { getSourceFileHref } from '@/lib/citations';
import { isSourceInProgress, type Source } from '@/lib/sources';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { RefreshWhileProcessing } from './sources/refresh-while-processing';
import { SourceStatusBadge } from './sources/source-status-badge';

// The workspace's left panel: each source under the number answers cite it by. Statuses
// update on their own while the worker processes.
export function WorkspaceSources({
  projectId,
  sources,
}: {
  projectId: string;
  sources: (Source & { number: number })[];
}) {
  if (sources.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No sources yet</EmptyTitle>
          <EmptyDescription>
            Upload PDFs or text files to give the AI something to work with.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const isProcessing = sources.some(isSourceInProgress);
  const hasReadySource = sources.some((source) => source.status === 'ready');

  return (
    <div className="flex flex-col gap-3">
      <RefreshWhileProcessing isProcessing={isProcessing} />
      {/* UC-16 E2: answers are only as good as processed sources. */}
      {!hasReadySource && (
        <p role="status" className="text-sm text-muted-foreground">
          No source is ready yet. Wait for processing to finish before asking; this list
          updates on its own.
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={getSourceFileHref(projectId, source.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Badge variant="outline">{source.number}</Badge>
              <span className="min-w-0 flex-1 truncate">{source.title}</span>
              <SourceStatusBadge status={source.status} />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
