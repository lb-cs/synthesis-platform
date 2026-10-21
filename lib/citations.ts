/**
 * Source numbers: until the worker writes chunks, an answer cites whole sources as [1],
 * [2], … Pure and client-safe, so the route and the Ask panel number sources the same way.
 */
import type { UIMessage } from 'ai';

import type { Source } from '@/lib/sources';

export type CitedSource = {
  number: number;
  id: string;
  title: string;
};

export type ChatMessageMetadata = {
  sources: CitedSource[];
};

/** What `useChat` holds: an AI SDK message carrying the source numbers it can cite. */
export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export type AnswerSegment =
  { kind: 'text'; text: string } | { kind: 'citation'; number: number };

const CITATION_PATTERN = /\[(\d+)\]/g;

/** Oldest first, so adding a source never renumbers the ones already cited. */
export function numberSources(sources: Source[]): (Source & { number: number })[] {
  const usable = sources.filter((source) => source.status !== 'failed');
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
