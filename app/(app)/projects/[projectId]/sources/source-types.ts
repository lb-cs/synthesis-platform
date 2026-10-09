import type { Json } from '@/lib/supabase/database.types';

export const SOURCE_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export const SOURCE_KINDS = ['pdf', 'text'] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type SourceListItem = {
  id: string;
  title: string;
  kind: SourceKind;
  status: SourceStatus;
  processingError: string | null;
  metadata: Json;
  createdAt: string;
};

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
