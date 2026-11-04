/**
 * Source numbers: until chat retrieves chunks, an answer cites whole sources as [1],
 * [2], … Pure and client-safe, so the route and the Ask panel number sources the same way.
 */
import type { UIMessage } from 'ai';

import type { Source } from '@/lib/sources';

export type CitedSource = {
  number: number;
  id: string;
  title: string;
  /** Set when `[number]` is one passage of the source rather than all of it. */
  pageNumber?: number | null;
};

export type ChatMessageMetadata = {
  sources: CitedSource[];
};

/** What `useChat` holds: an AI SDK message carrying the source numbers it can cite. */
export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export type AnswerSegment =
  { kind: 'text'; text: string } | { kind: 'citation'; number: number };

const CITATION_PATTERN = /\[(\d+)\]/g;

const CITATION_HREF_PREFIX = '#source-';

export function getSourceFileHref(projectId: string, sourceId: string): string {
  return `/api/projects/${projectId}/sources/${sourceId}/file`;
}

/** Opens the cited file; PDF viewers jump to `#page=` and other files ignore it. */
export function getCitationHref(projectId: string, source: CitedSource): string {
  const href = getSourceFileHref(projectId, source.id);

  if (!source.pageNumber) {
    return href;
  }

  return `${href}#page=${source.pageNumber}`;
}

/** "Report.pdf" or "Report.pdf, p. 3": how a citation names what it points at. */
export function getCitationLabel(source: CitedSource): string {
  if (!source.pageNumber) {
    return source.title;
  }

  return `${source.title}, p. ${source.pageNumber}`;
}

export type NumberedFileSource = Source & { storagePath: string; number: number };

function hasFile(source: Source): source is Source & { storagePath: string } {
  return source.storagePath !== null;
}

/**
 * Oldest first, so adding a source never renumbers the ones already cited. Only files:
 * chat sends whole files until it retrieves chunks (CECS491-73), and a link has none.
 */
export function numberSources(sources: Source[]): NumberedFileSource[] {
  const usable = sources.filter((source) => source.status !== 'failed').filter(hasFile);
  const oldestFirst = usable.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

  return oldestFirst.map((source, index) => {
    return { ...source, number: index + 1 };
  });
}

export function toCitedSources(sources: (Source & { number: number })[]): CitedSource[] {
  return sources.map(({ number, id, title }) => ({ number, id, title }));
}

/** Splits an answer into plain text and `[n]` markers, in order. */
export function splitCitations(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_PATTERN)) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }

    segments.push({ kind: 'citation', number: Number(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

/** Turns each `[n]` into a Markdown link, so a Markdown renderer hands it to our link component. */
export function linkCitations(text: string): string {
  return text.replace(CITATION_PATTERN, `[$1](${CITATION_HREF_PREFIX}$1)`);
}

/** The source number behind a link `linkCitations` wrote, or null for any other link. */
export function getCitationNumber(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) {
    return null;
  }

  const number = Number(href.slice(CITATION_HREF_PREFIX.length));

  return Number.isInteger(number) ? number : null;
}

/** The sources an answer actually cites, in source-number order. */
export function getCitedSources(text: string, sources: CitedSource[]): CitedSource[] {
  const citedNumbers = new Set<number>();

  splitCitations(text).forEach((segment) => {
    if (segment.kind === 'citation') {
      citedNumbers.add(segment.number);
    }
  });

  return sources.filter((source) => citedNumbers.has(source.number));
}

export function getMessageText(message: ChatUIMessage): string {
  const textParts = message.parts.filter((part) => part.type === 'text');

  return textParts.map((part) => part.text).join('');
}
