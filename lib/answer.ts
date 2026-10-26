/**
 * Answers a question from a project's sources through Vercel AI Gateway. The naive
 * version: no chunks exist yet, so every usable source goes to the model whole, numbered
 * for citation. Swap `loadSourceDocuments` for `match_document_chunks` once the worker
 * writes chunks; the route and the Ask panel stay as they are.
 */
import { streamText, type ModelMessage, type UserContent } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChatMessage } from '@/lib/chat';
import type { Source } from '@/lib/sources';
import { downloadFile } from '@/lib/storage';
import type { Database } from '@/lib/supabase/database.types';

// A gateway model id: swap provider or model here and nowhere else.
const CHAT_MODEL = 'anthropic/claude-sonnet-5.5';

const INSTRUCTIONS = `You are a research assistant inside a project workspace.
Answer the user's question using only the numbered sources provided. Never use outside knowledge.
Cite every claim with the number of the source it comes from, in square brackets, like [1] or [2][3].
If the sources do not contain the answer, reply exactly: "No matching information found in your sources."
Write plain prose in short paragraphs. Do not use Markdown headings, bold, or tables.`;

export type SourceDocument =
  | { number: number; title: string; kind: 'pdf'; data: Uint8Array }
  | { number: number; title: string; kind: 'text'; text: string };

export type SourceDocumentsResult =
  { ok: true; documents: SourceDocument[] } | { ok: false; kind: 'storage-error' };

type Client = SupabaseClient<Database>;

type NumberedSource = Source & { number: number };

type UserPart = Exclude<UserContent, string>[number];

async function loadSourceDocument(
  supabase: Client,
  source: NumberedSource,
): Promise<SourceDocument | null> {
  const result = await downloadFile(supabase, source.storagePath);

  if (!result.ok) {
    return null;
  }

  const { number, title } = source;

  if (source.kind === 'pdf') {
    const bytes = await result.file.arrayBuffer();

    return { number, title, kind: 'pdf', data: new Uint8Array(bytes) };
  }

  return { number, title, kind: 'text', text: await result.file.text() };
}

/** Downloads every numbered source. One missing file fails the lot, so numbers never drift. */
export async function loadSourceDocuments(
  supabase: Client,
  sources: NumberedSource[],
): Promise<SourceDocumentsResult> {
  const documents = await Promise.all(
    sources.map((source) => loadSourceDocument(supabase, source)),
  );

  if (documents.some((document) => document === null)) {
    return { ok: false, kind: 'storage-error' };
  }

  return { ok: true, documents: documents as SourceDocument[] };
}

function toSourceParts(document: SourceDocument): UserPart[] {
  const label = `Source [${document.number}]: ${document.title}`;

  if (document.kind === 'text') {
    return [{ type: 'text', text: `${label}\n\n${document.text}` }];
  }

  return [
    { type: 'text', text: label },
    {
      type: 'file',
      data: document.data,
      mediaType: 'application/pdf',
      filename: document.title,
    },
  ];
}

function toHistoryMessages(history: ChatMessage[]): ModelMessage[] {
  // Models expect the conversation to open with the user, and the limit can cut mid-pair.
  const firstUserIndex = history.findIndex((message) => message.role === 'user');

  if (firstUserIndex === -1) {
    return [];
  }

  return history.slice(firstUserIndex).map((message) => {
    return { role: message.role, content: message.content };
  });
}

/** Streams an answer; the sources ride along with the question, history before them. */
export function streamAnswer({
  documents,
  history,
  question,
}: {
  documents: SourceDocument[];
  history: ChatMessage[];
  question: string;
}) {
  const sourceParts = documents.flatMap(toSourceParts);
  const questionMessage: ModelMessage = {
    role: 'user',
    content: [...sourceParts, { type: 'text', text: `Question: ${question}` }],
  };

  return streamText({
    model: CHAT_MODEL,
    instructions: INSTRUCTIONS,
    messages: [...toHistoryMessages(history), questionMessage],
  });
}
