'use client';

import { FileText, SearchX } from 'lucide-react';
import { useState } from 'react';

import type { Source } from '@/lib/sources';

import { SOURCE_KINDS, SOURCE_STATUSES } from '@/lib/sources';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { filterSources, type SourceFilters } from './filter-sources';
import { SourceDetailsSheet } from './source-details-sheet';
import { SourceRow } from './source-row';
import { KIND_LABELS, STATUS_LABELS } from './source-types';

const STATUS_OPTIONS = ['all', ...SOURCE_STATUSES] as const;
const KIND_OPTIONS = ['all', ...SOURCE_KINDS] as const;

const STATUS_OPTION_LABELS: Record<SourceFilters['status'], string> = {
  all: 'All',
  ...STATUS_LABELS,
};

const KIND_OPTION_LABELS: Record<SourceFilters['kind'], string> = {
  all: 'All',
  ...KIND_LABELS,
};

// Pressing the active toggle again clears the group, which we read as "all".
function pickOption<Option extends string>(
  options: readonly Option[],
  values: string[],
  fallback: Option,
): Option {
  return options.find((option) => option === values[0]) ?? fallback;
}

export function SourcesList({ sources }: { sources: Source[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SourceFilters['status']>('all');
  const [kind, setKind] = useState<SourceFilters['kind']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const visibleSources = filterSources(sources, { query, status, kind });
  const selectedSource = sources.find((source) => source.id === selectedId);

  function selectSource(sourceId: string) {
    setSelectedId(sourceId);
    setIsDetailsOpen(true);
  }

  function clearFilters() {
    setQuery('');
    setStatus('all');
    setKind('all');
  }

  if (sources.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No sources yet</EmptyTitle>
          <EmptyDescription>
            Uploaded sources will be listed here with their processing status.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input
          type="search"
          aria-label="Search sources by title"
          placeholder="Search by title"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="lg:max-w-xs"
        />
        <div className="flex flex-wrap gap-3">
          <ToggleGroup
            variant="outline"
            size="sm"
            aria-label="Filter by status"
            value={[status]}
            onValueChange={(values) =>
              setStatus(pickOption(STATUS_OPTIONS, values, 'all'))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {STATUS_OPTION_LABELS[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            variant="outline"
            size="sm"
            aria-label="Filter by type"
            value={[kind]}
            onValueChange={(values) => setKind(pickOption(KIND_OPTIONS, values, 'all'))}
          >
            {KIND_OPTIONS.map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {KIND_OPTION_LABELS[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        Showing {visibleSources.length} of {sources.length} sources
      </p>

      {visibleSources.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No matching sources</EmptyTitle>
            <EmptyDescription>
              Try a different search or clear the filters.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="divide-y rounded-xl border">
          {visibleSources.map((source) => (
            <SourceRow key={source.id} source={source} onSelect={selectSource} />
          ))}
        </ul>
      )}

      <SourceDetailsSheet
        source={selectedSource}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>
  );
}
