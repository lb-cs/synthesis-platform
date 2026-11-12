import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import {
  embedQuestion,
  HISTORY_LIMIT,
  streamGroundedAnswer,
  toVectorLiteral,
} from '@/lib/ai';
import { findChatPassages, getChatSources, toChatCitations } from '@/lib/answer';
import {
  createChatMessage,
  createCitations,
  listRecentChatMessages,
  splitRetry,
} from '@/lib/chat';
import { CHAT_ERROR_MESSAGES, type ChatErrorCode } from '@/lib/chat-errors';
import { getMessageText, type ChatUIMessage } from '@/lib/citations';
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

// Retrieves the passages closest to one question, streams a cited answer as an AI SDK UI
// message stream, then saves the answer and the passages it cites.
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

  const chatSources = getChatSources(sourcesResult.sources);

  if (chatSources.length === 0) {
    return chatError('no-sources', 409);
  }

  // Sources still pending or processing have no chunks to answer from yet.
  const hasReadySource = chatSources.some((source) => source.status === 'ready');

  if (!hasReadySource) {
    return chatError('sources-processing', 409);
  }

  const question = parsed.data.question;
  const [historyResult, embeddingResult] = await Promise.all([
    listRecentChatMessages(supabase, project.id, HISTORY_LIMIT),
    embedQuestion(question),
  ]);

  if (!historyResult.ok) {
    return Response.json({ error: 'Could not load the conversation.' }, { status: 500 });
  }

  if (!embeddingResult.ok) {
    return chatError('ai-unavailable', 503);
  }

  const passagesResult = await findChatPassages(
    supabase,
    project.id,
    chatSources,
    question,
    toVectorLiteral(embeddingResult.embedding),
  );

  if (!passagesResult.ok) {
    return Response.json({ error: 'Could not search your sources.' }, { status: 500 });
  }

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

  const passages = passagesResult.passages;
  // No passages still goes to the model: the prompt says none matched, and it answers so.
  const { result, passageNumbers } = streamGroundedAnswer({
    chunks: passages,
    history: earlier,
    question,
  });
  const citations = toChatCitations(passages, passageNumbers);

  const stream = toUIMessageStream<ToolSet, ChatUIMessage>({
    stream: result.stream,
    generateMessageId: generateId,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { sources: citations };
      }
    },
    onEnd: async ({ responseMessage, outcome }) => {
      const answer = getMessageText(responseMessage);

      // Nothing streamed, so there is nothing worth keeping.
      if (!answer) {
        return;
      }

      const status = outcome.status === 'completed' ? 'complete' : 'failed';

      const answerResult = await createChatMessage(supabase, project.id, {
        role: 'assistant',
        content: answer,
        status,
      });

      if (!answerResult.ok) {
        return;
      }

      // The answer is already on screen; a failed save only costs its links after a reload.
      await createCitations(supabase, answerResult.message.id, answer, passageNumbers);
    },
    onError: () => {
      return CHAT_ERROR_MESSAGES['ai-unavailable'];
    },
  });

  return createUIMessageStreamResponse({ stream });
}
