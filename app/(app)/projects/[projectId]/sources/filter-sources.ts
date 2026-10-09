import type { Source, SourceKind, SourceStatus } from '@/lib/sources';

export type SourceFilters = {
  query: string;
  status: SourceStatus | 'all';
  kind: SourceKind | 'all';
};

export function filterSources(sources: Source[], filters: SourceFilters): Source[] {
  const query = filters.query.trim().toLowerCase();

  return sources.filter((source) => {
    if (filters.status !== 'all' && source.status !== filters.status) {
      return false;
    }

    if (filters.kind !== 'all' && source.kind !== filters.kind) {
      return false;
    }

    return source.title.toLowerCase().includes(query);
  });
}
