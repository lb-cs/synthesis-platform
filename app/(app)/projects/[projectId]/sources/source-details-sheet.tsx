import type { Source } from '@/lib/sources';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { formatAddedDate, getMetadataEntries } from './format-source';
import { SourceStatusBadge } from './source-status-badge';
import { KIND_LABELS } from './source-types';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SourceDetailsSheet({
  source,
  open,
  onOpenChange,
}: {
  source: Source | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!source) {
    return null;
  }

  const metadataEntries = getMetadataEntries(source.metadata);
  const failureReason = source.processingError ?? 'No reason was recorded.';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{source.title}</SheetTitle>
          <SheetDescription>Source details</SheetDescription>
        </SheetHeader>
        <dl className="flex flex-col gap-4 px-4 text-sm">
          <DetailRow label="Status">
            <SourceStatusBadge status={source.status} />
          </DetailRow>
          {source.status === 'failed' && (
            <DetailRow label="Why it failed">
              <span className="text-destructive">{failureReason}</span>
            </DetailRow>
          )}
          <DetailRow label="Type">{KIND_LABELS[source.kind]}</DetailRow>
          <DetailRow label="Added">{formatAddedDate(source.createdAt)}</DetailRow>
          {metadataEntries.map((entry) => (
            <DetailRow key={entry.label} label={entry.label}>
              {entry.value}
            </DetailRow>
          ))}
        </dl>
        {metadataEntries.length === 0 && (
          <p className="px-4 text-sm text-muted-foreground">
            More details appear once the source has been processed.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
