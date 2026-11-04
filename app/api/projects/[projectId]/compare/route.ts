import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import { embedQuestion, streamComparison, toVectorLiteral } from '@/lib/ai';
import type { ChatUIMessage } from '@/lib/citations';
import {
  findComparisonPassages,
  getComparableSources,
  MAX_COMPARED_SOURCES,
  MAX_TOPIC_LENGTH,
  MIN_COMPARED_SOURCES,
} from '@/lib/comparison';
import { toPassageCitations } from '@/lib/passages';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';

import { projectIdSchema } from '@/app/api/projects/schema';

import { compareSourcesSchema } from './schema';

type Context = RouteContext<'/api/projects/[projectId]/compare'>;

const INVALID_REQUEST = `Pick ${MIN_COMPARED_SOURCES} to ${MAX_COMPARED_SOURCES} different sources and a topic of up to ${MAX_TOPIC_LENGTH} characters.`;

const AI_UNAVAILABLE = 'The AI service is unavailable right now. Try again in a moment.';

// Streams a cited comparison of the chosen sources on one topic. Nothing is saved.
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
  const parsed = compareSourcesSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  const project = projectResult.project;
  const sourcesResult = await listSources(supabase, project.id);

  if (!sourcesResult.ok) {
    return Response.json({ error: 'Could not load sources.' }, { status: 500 });
  }

  const comparable = getComparableSources(sourcesResult.sources);
  // Keep the user's order: it is the order the comparison lists the sources in.
  const chosen = parsed.data.sourceIds.flatMap((sourceId) => {
    return comparable.filter((source) => source.id === sourceId);
  });

  if (chosen.length !== parsed.data.sourceIds.length) {
    return Response.json(
      { error: 'Every source you compare must be in this project and ready.' },
      { status: 409 },
    );
  }

  const topic = parsed.data.topic;
  const embeddingResult = await embedQuestion(topic);

  if (!embeddingResult.ok) {
    return Response.json({ error: AI_UNAVAILABLE }, { status: 503 });
  }

  const passagesResult = await findComparisonPassages(
    supabase,
    project.id,
    chosen,
    toVectorLiteral(embeddingResult.embedding),
  );

  if (!passagesResult.ok) {
    return Response.json({ error: 'Could not search your sources.' }, { status: 500 });
  }

  const comparedSources = passagesResult.sources;
  const { result, passageNumbers } = streamComparison({
    sources: comparedSources,
    topic,
    abortSignal: request.signal,
  });
  const citations = toPassageCitations(comparedSources, passageNumbers);

  const stream = toUIMessageStream<ToolSet, ChatUIMessage>({
    stream: result.stream,
    generateMessageId: generateId,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { sources: citations };
      }
    },
    onError: () => {
      return AI_UNAVAILABLE;
    },
  });

  return createUIMessageStreamResponse({ stream });
}
