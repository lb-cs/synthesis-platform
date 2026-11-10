/**
 * Passages for the Analysis tabs: group the chunks a search or sample returned under
 * their source, and turn the prompt's passage numbers into citations. Pure and
 * client-safe (type-only imports), like `lib/citations.ts`.
 */
import type { PassageNumber, SourcePassages } from '@/lib/ai';
import type { CitedSource } from '@/lib/citations';
import type { Source } from '@/lib/sources';

export type PassageSource = Pick<Source, 'id' | 'title'>;

/** Ready sources, oldest first: only those have chunks to search or sample. */
export function getReadySources(sources: Source[]): PassageSource[] {
  const ready = sources.filter((source) => source.status === 'ready');
  const oldestFirst = ready.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

  return oldestFirst.map(({ id, title }) => ({ id, title }));
}

/** A row from match_source_chunks or sample_source_chunks. */
export type PassageRow = {
  id: string;
  source_id: string;
  content: string;
  page_number: number | null;
};

/** One group per source, in the order `sources` gives; a source with no rows gets none. */
export function groupPassages(
  sources: PassageSource[],
  rows: PassageRow[],
): SourcePassages[] {
  return sources.map((source) => {
    const sourceRows = rows.filter((row) => row.source_id === source.id);
    const chunks = sourceRows.map((row) => {
      return {
        id: row.id,
        sourceTitle: source.title,
        content: row.content,
        pageNumber: row.page_number,
      };
    });

    return { id: source.id, title: source.title, chunks };
  });
}

/** Each `[n]` the answer can cite, as the source and page it opens. */
export function toPassageCitations(
  sources: SourcePassages[],
  passageNumbers: PassageNumber[],
): CitedSource[] {
  const passageByChunkId = new Map(
    sources.flatMap((source) => {
      return source.chunks.map((chunk) => {
        const passage = {
          id: source.id,
          title: source.title,
          pageNumber: chunk.pageNumber,
          passage: chunk.content,
        };

        return [chunk.id, passage] as const;
      });
    }),
  );

  return passageNumbers.flatMap(({ number, chunkId }) => {
    const passage = passageByChunkId.get(chunkId);

    return passage ? [{ number, ...passage }] : [];
  });
}
