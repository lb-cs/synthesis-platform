import type { SourceKind, SourceStatus } from '@/lib/sources';

export const STATUS_LABELS: Record<SourceStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

export const KIND_LABELS: Record<SourceKind, string> = {
  pdf: 'PDF',
  text: 'Text',
};
