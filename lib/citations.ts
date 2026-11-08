/**
 * Citations in an answer: `[n]` markers and the source and page each one opens. An
 * answer's numbers are its passage numbers, so they restart with every answer. Pure and
 * client-safe, so the route and the Ask panel read them the same way.
 */
import type { UIMessage } from 'ai';

export type CitedSource = {
  number: number;
  id: string;
  title: string;
  /** The page the cited passage is on, when the file has pages. */
  pageNumber?: number | null;
};

export type ChatMessageMetadata = {
  sources: CitedSource[];
};

/** What `useChat` holds: an AI SDK message carrying what each of its `[n]` opens. */
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

/** Every `[n]` an answer uses, once each. */
export function getCitedNumbers(text: string): Set<number> {
  const citedNumbers = new Set<number>();

  splitCitations(text).forEach((segment) => {
    if (segment.kind === 'citation') {
      citedNumbers.add(segment.number);
    }
  });

  return citedNumbers;
}

/** The citations an answer actually uses, in number order. */
export function getCitedSources(text: string, sources: CitedSource[]): CitedSource[] {
  const citedNumbers = getCitedNumbers(text);

  return sources.filter((source) => citedNumbers.has(source.number));
}

export function getMessageText(message: ChatUIMessage): string {
  const textParts = message.parts.filter((part) => part.type === 'text');

  return textParts.map((part) => part.text).join('');
}
