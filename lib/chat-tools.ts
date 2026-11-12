/**
 * The tools chat's model can call to fetch passages itself (UC-16), when the ones
 * retrieved up front don't answer the question: search the project or one source, or
 * read a spread of one source. Every passage a tool returns gets the next passage
 * number in the answer's `PassageBook`, so the model cites it like any other.
 * Server-only: runs as the signed-in user, so RLS scopes every query.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { embedQuestion, formatPassage, toVectorLiteral } from '@/lib/ai';
import {
  findProjectPassages,
  findSourceByName,
  findSourcePassages,
  numberPassages,
  sampleSourcePassages,
  type ChatPassagesResult,
  type PassageBook,
} from '@/lib/answer';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

const MAX_QUERY_LENGTH = 500;
const MAX_SOURCE_NAME_LENGTH = 200;

// What the model reads when a tool can't help. It answers from what it already has.
const NO_PASSAGES = 'No passages matched.';
const SEARCH_FAILED = 'The search failed. Answer from the passages you already have.';

type Client = SupabaseClient<Database>;

type ChatToolsInput = {
  supabase: Client;
  projectId: string;
  sources: Source[];
  book: PassageBook;
};

function unknownSource(name: string, sources: Source[]): string {
  const ready = sources.filter((source) => source.status === 'ready');
  const titles = ready.map((source) => source.title);

  return `No ready source is called "${name}". The ready sources are: ${titles.join('; ')}`;
}

/** A tool's result as the model reads it: the passages, numbered by the book. */
function toToolResult(book: PassageBook, result: ChatPassagesResult): string {
  if (!result.ok) {
    return SEARCH_FAILED;
  }

  if (result.passages.length === 0) {
    return NO_PASSAGES;
  }

  const numbered = numberPassages(book, result.passages);
  const formatted = numbered.map(({ passage, number }) => {
    return formatPassage(passage, number);
  });

  return formatted.join('\n\n');
}

export function createChatTools({
  supabase,
  projectId,
  sources,
  book,
}: ChatToolsInput): ToolSet {
  return {
    searchSources: tool({
      description:
        'Search the project for passages about a query. Returns numbered passages you can cite. Give `source` to search only one source.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(MAX_QUERY_LENGTH)
          .describe('What to look for, in plain words.'),
        source: z
          .string()
          .max(MAX_SOURCE_NAME_LENGTH)
          .optional()
          .describe('A title from the source list, to search only that source.'),
      }),
      execute: async ({ query, source: sourceName }) => {
        const source = sourceName ? findSourceByName(sourceName, sources) : null;

        if (sourceName && source === null) {
          return unknownSource(sourceName, sources);
        }

        const embeddingResult = await embedQuestion(query);

        if (!embeddingResult.ok) {
          return SEARCH_FAILED;
        }

        const queryEmbedding = toVectorLiteral(embeddingResult.embedding);
        const result = source
          ? await findSourcePassages(supabase, projectId, source, queryEmbedding)
          : await findProjectPassages(supabase, projectId, sources, queryEmbedding);

        return toToolResult(book, result);
      },
    }),
    readSource: tool({
      description:
        'Read numbered passages spread from the start to the end of one source. Use it to summarize or describe a whole source.',
      inputSchema: z.object({
        source: z
          .string()
          .min(1)
          .max(MAX_SOURCE_NAME_LENGTH)
          .describe('A title from the source list.'),
      }),
      execute: async ({ source: sourceName }) => {
        const source = findSourceByName(sourceName, sources);

        if (source === null) {
          return unknownSource(sourceName, sources);
        }

        const result = await sampleSourcePassages(supabase, source);

        return toToolResult(book, result);
      },
    }),
  };
}
