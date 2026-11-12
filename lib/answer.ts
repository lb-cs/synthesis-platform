/**
 * Answers a question by retrieval (UC-16): the route embeds the question, this finds the
 * closest chunks across the project's ready sources, or a spread of chunks from the
 * sources the question names, and only those go to the model, numbered as passages. The
 * answer cites passage numbers; `citations` rows keep them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { PassageNumber, RetrievedChunk } from '@/lib/ai';
import type { CitedSource } from '@/lib/citations';
import type { PassageRow } from '@/lib/passages';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

// Enough to cover a question that spans a few sources, small enough to keep each
// question cheap however many sources the project has.
const CHAT_PASSAGE_COUNT = 8;

// A question that names sources is answered from those alone, so each can give more:
// this many passages, shared between the named sources.
const NAMED_PASSAGE_COUNT = 16;
const NAMED_SOURCE_LIMIT = 4;

// Shorter titles ("ai", "v2") turn up in questions that aren't about the source.
const MIN_NAME_LENGTH = 3;

/** A retrieved chunk plus the source it came from, so a citation can open it. */
export type ChatPassage = RetrievedChunk & { sourceId: string; sourceUrl: string | null };

export type ChatPassagesResult =
  { ok: true; passages: ChatPassage[] } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

/**
 * The sources chat can draw on, oldest first: files and links that haven't failed. Only
 * the `ready` ones are searchable yet; the rest are still processing.
 */
export function getChatSources(sources: Source[]): Source[] {
  const usable = sources.filter((source) => source.status !== 'failed');

  return usable.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** How a question can name a source: its title, and a link's host (`workos.com`). */
function getSourceNames(source: Source): string[] {
  if (source.url === null || !URL.canParse(source.url)) {
    return [source.title];
  }

  const host = new URL(source.url).hostname.replace(/^www\./, '');

  return [source.title, host];
}

/** Lowercase words padded with spaces, so `includes` only matches whole words. */
function toWordString(text: string): string {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const nonEmpty = words.filter((word) => word.length > 0);

  return ` ${nonEmpty.join(' ')} `;
}

/**
 * The ready sources a question names by title or link host, whatever the punctuation
 * ("summarize workos.com", "the early 2025 ai study paper"). When one matched name
 * sits inside a longer one ("archive" in "archive-1"), only the longer counts.
 */
export function findNamedSources(question: string, sources: Source[]): Source[] {
  const questionWords = toWordString(question);

  const matches = sources.flatMap((source) => {
    if (source.status !== 'ready') {
      return [];
    }

    const names = getSourceNames(source).map(toWordString);
    const name = names.find((candidate) => {
      // Padding is two characters, so this skips names too short to mean anything.
      return candidate.length >= MIN_NAME_LENGTH + 2 && questionWords.includes(candidate);
    });

    return name === undefined ? [] : [{ source, name }];
  });

  const longest = matches.filter((match) => {
    return !matches.some((other) => {
      return other.name.length > match.name.length && other.name.includes(match.name);
    });
  });

  return longest.slice(0, NAMED_SOURCE_LIMIT).map((match) => match.source);
}

/** `count` chunk indexes spread evenly from the first chunk to the last. */
function spreadChunkIndexes(chunkTotal: number, count: number): number[] {
  if (chunkTotal <= count) {
    return Array.from({ length: chunkTotal }, (_, index) => index);
  }

  if (count === 1) {
    return [0];
  }

  const step = (chunkTotal - 1) / (count - 1);

  return Array.from({ length: count }, (_, index) => Math.round(index * step));
}

/**
 * Up to `count` chunks spread through one source, in reading order, so an answer about
 * the whole source (a summary) sees its start, middle, and end. Null on a database
 * error. Relies on the worker numbering a source's chunks 0…n-1.
 */
async function sampleSourceChunks(
  supabase: Client,
  sourceId: string,
  count: number,
): Promise<PassageRow[] | null> {
  const total = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId);

  if (total.error || total.count === null) {
    return null;
  }

  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, source_id, content, page_number')
    .eq('source_id', sourceId)
    .in('chunk_index', spreadChunkIndexes(total.count, count))
    .order('chunk_index');

  return error ? null : data;
}

/**
 * Passages from the sources the question names, and only those: for each, a sample
 * spread through it, then its chunks closest to the question. A project-wide search
 * can't do this, because a source's name is not in its chunks' text.
 */
async function findNamedSourcePassages(
  supabase: Client,
  projectId: string,
  named: Source[],
  queryEmbedding: string,
): Promise<ChatPassagesResult> {
  const perSource = Math.floor(NAMED_PASSAGE_COUNT / named.length);
  const closestCount = Math.ceil(perSource / 2);
  const spreadCount = perSource - closestCount;

  const [closest, ...samples] = await Promise.all([
    supabase.rpc('match_source_chunks', {
      project_id: projectId,
      source_ids: named.map((source) => source.id),
      query_embedding: queryEmbedding,
      match_count_per_source: closestCount,
    }),
    ...named.map((source) => sampleSourceChunks(supabase, source.id, spreadCount)),
  ]);

  if (closest.error || samples.includes(null)) {
    return { ok: false, kind: 'database-error' };
  }

  const seen = new Set<string>();

  const passages = named.flatMap((source, index) => {
    const spread = samples[index] ?? [];
    const matched = closest.data.filter((row) => row.source_id === source.id);
    const rows = [...spread, ...matched].filter((row) => {
      const isNew = !seen.has(row.id);
      seen.add(row.id);

      return isNew;
    });

    return rows.map((row) => toChatPassage(row, source));
  });

  return { ok: true, passages };
}

function toChatPassage(row: PassageRow, source: Source): ChatPassage {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceTitle: source.title,
    sourceUrl: source.url,
    content: row.content,
    pageNumber: row.page_number,
  };
}

/**
 * The passages a question is answered from. A question that names sources ("summarize
 * workos.com") gets passages from those sources only; any other gets the chunks closest
 * to it across the project, best first. `sources` gives the titles; a chunk whose source
 * isn't in it (removed mid-request) is dropped. Runs as the signed-in user, so RLS scopes
 * it, and only ready sources are searched.
 */
export async function findChatPassages(
  supabase: Client,
  projectId: string,
  sources: Source[],
  question: string,
  queryEmbedding: string,
): Promise<ChatPassagesResult> {
  const named = findNamedSources(question, sources);

  if (named.length > 0) {
    const namedResult = await findNamedSourcePassages(
      supabase,
      projectId,
      named,
      queryEmbedding,
    );

    // A named source with no chunks falls through to the project-wide search.
    if (!namedResult.ok || namedResult.passages.length > 0) {
      return namedResult;
    }
  }

  const { data, error } = await supabase.rpc('match_document_chunks', {
    project_id: projectId,
    query_embedding: queryEmbedding,
    match_count: CHAT_PASSAGE_COUNT,
  });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));

  const passages = data.flatMap((row) => {
    const source = sourceById.get(row.source_id);

    return source === undefined ? [] : [toChatPassage(row, source)];
  });

  return { ok: true, passages };
}

/** Each `[n]` the answer can cite, as the source and page it opens. */
export function toChatCitations(
  passages: ChatPassage[],
  passageNumbers: PassageNumber[],
): CitedSource[] {
  const passageById = new Map(passages.map((passage) => [passage.id, passage]));

  return passageNumbers.flatMap(({ number, chunkId }) => {
    const passage = passageById.get(chunkId);

    if (!passage) {
      return [];
    }

    const citation: CitedSource = {
      number,
      id: passage.sourceId,
      title: passage.sourceTitle,
      pageNumber: passage.pageNumber,
      passage: passage.content,
      url: passage.sourceUrl,
    };

    return [citation];
  });
}
