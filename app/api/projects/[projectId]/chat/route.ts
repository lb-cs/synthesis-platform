import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import { loadSourceDocuments, streamAnswer } from '@/lib/answer';
import { createChatMessage, listRecentChatMessages } from '@/lib/chat';
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

// Turns the model sees on top of the sources: enough for follow-ups, not the whole chat.
const HISTORY_LIMIT = 10;

type Context = RouteContext<'/api/projects/[projectId]/chat'>;

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
    return Response.json(
      { error: 'Add a source to this project before asking.' },
      { status: 409 },
    );
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
  const userMessageResult = await createChatMessage(supabase, project.id, {
    role: 'user',
    content: question,
    status: 'complete',
  });

  if (!userMessageResult.ok) {
    return Response.json({ error: 'Could not save your question.' }, { status: 500 });
  }

  const result = streamAnswer({
    documents: documentsResult.documents,
    history: historyResult.messages,
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
      return 'The AI service is unavailable right now. Try again in a moment.';
    },
  });

  return createUIMessageStreamResponse({ stream });
}
