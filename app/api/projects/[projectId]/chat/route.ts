import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import { HISTORY_LIMIT } from '@/lib/ai';
import { loadSourceDocuments, streamAnswer } from '@/lib/answer';
import { createChatMessage, listRecentChatMessages, splitRetry } from '@/lib/chat';
import { CHAT_ERROR_MESSAGES, type ChatErrorCode } from '@/lib/chat-errors';
import {
  getMessageText,
  numberSources,
  toCitedSources,
  type ChatUIMessage,
} from '@/lib/citations';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema } from '@/app/api/projects/schema';

import { askQuestionSchema } from './schema';

type Context = RouteContext<'/api/projects/[projectId]/chat'>;

// The Ask panel reads `code` to show the right message; `error` is the same words.
function chatError(code: ChatErrorCode, status: number) {
  return Response.json({ error: CHAT_ERROR_MESSAGES[code], code }, { status });
}

// Streams an answer to one question as an AI SDK UI message stream, then saves it.
export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  const parsedProjectId = projectIdSchema.safeParse(projectId);

  if (!parsedProjectId.success) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const projectResult = await getProject(supabase, parsedProjectId.data);

  if (!projectResult.ok && projectResult.kind === 'not-found') {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!projectResult.ok) {
    return Response.json({ error: 'Could not load project.' }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = askQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Send a question between 1 and 4000 characters.' },
      { status: 400 },
    );
  }

  const project = projectResult.project;
  const sourcesResult = await listSources(supabase, project.id);

  if (!sourcesResult.ok) {
    return Response.json({ error: 'Could not load sources.' }, { status: 500 });
  }

  const numberedSources = numberSources(sourcesResult.sources);

  if (numberedSources.length === 0) {
    return chatError('no-sources', 409);
  }

  // Sources still pending or processing have no chunks to answer from yet.
  const hasReadySource = numberedSources.some((source) => source.status === 'ready');

  if (!hasReadySource) {
    return chatError('sources-processing', 409);
  }

  const [historyResult, documentsResult] = await Promise.all([
    listRecentChatMessages(supabase, project.id, HISTORY_LIMIT),
    loadSourceDocuments(supabase, numberedSources),
  ]);

  if (!historyResult.ok) {
    return Response.json({ error: 'Could not load the conversation.' }, { status: 500 });
  }

  if (!documentsResult.ok) {
    return Response.json({ error: 'Could not read your sources.' }, { status: 500 });
  }

  const question = parsed.data.question;
  const { isRetry, earlier } = splitRetry(historyResult.messages, question);
  const savedQuestion = isRetry
    ? { ok: true as const }
    : await createChatMessage(supabase, project.id, {
        role: 'user',
        content: question,
        status: 'complete',
      });

  if (!savedQuestion.ok) {
    return Response.json({ error: 'Could not save your question.' }, { status: 500 });
  }

  const result = streamAnswer({
    documents: documentsResult.documents,
    history: earlier,
    question,
  });
  const citedSources = toCitedSources(numberedSources);

  const stream = toUIMessageStream<ToolSet, ChatUIMessage>({
    stream: result.stream,
    generateMessageId: generateId,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { sources: citedSources };
      }
    },
    onEnd: async ({ responseMessage, outcome }) => {
      const answer = getMessageText(responseMessage);

      // Nothing streamed, so there is nothing worth keeping.
      if (!answer) {
        return;
      }

      const status = outcome.status === 'completed' ? 'complete' : 'failed';

      await createChatMessage(supabase, project.id, {
        role: 'assistant',
        content: answer,
        status,
      });
    },
    onError: () => {
      return CHAT_ERROR_MESSAGES['ai-unavailable'];
    },
  });

  return createUIMessageStreamResponse({ stream });
}
