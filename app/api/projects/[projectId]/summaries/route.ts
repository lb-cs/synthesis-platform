import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import { streamSummary } from '@/lib/ai';
import type { ChatUIMessage } from '@/lib/citations';
import { toPassageCitations } from '@/lib/passages';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';
import {
  getNoTextMessage,
  getSummarizableSources,
  MAX_SUMMARIZED_SOURCES,
  MIN_SUMMARIZED_SOURCES,
  sampleSummaryPassages,
} from '@/lib/summaries';

import { projectIdSchema } from '@/app/api/projects/schema';

import { summarizeSourcesSchema } from './schema';

type Context = RouteContext<'/api/projects/[projectId]/summaries'>;

const INVALID_REQUEST = `Pick ${MIN_SUMMARIZED_SOURCES} to ${MAX_SUMMARIZED_SOURCES} different sources to summarize.`;

const AI_UNAVAILABLE = 'The AI service is unavailable right now. Try again in a moment.';

// Streams a cited summary of the chosen sources. Nothing is saved.
export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const supabaseUser = await getSupabaseUser(supabase);

  if (!supabaseUser) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  const parsedProjectId = projectIdSchema.safeParse(projectId);

  if (!parsedProjectId.success) {
    return Response.json({ error: 'Workspace not found.' }, { status: 404 });
  }

  const projectResult = await getProject(supabase, parsedProjectId.data);

  if (!projectResult.ok && projectResult.kind === 'not-found') {
    return Response.json({ error: 'Workspace not found.' }, { status: 404 });
  }

  if (!projectResult.ok) {
    return Response.json({ error: 'Could not load workspace.' }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = summarizeSourcesSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  const project = projectResult.project;
  const sourcesResult = await listSources(supabase, project.id);

  if (!sourcesResult.ok) {
    return Response.json({ error: 'Could not load sources.' }, { status: 500 });
  }

  const summarizable = getSummarizableSources(sourcesResult.sources);
  // Keep the user's order: it is the order the summary lists the sources in.
  const chosen = parsed.data.sourceIds.flatMap((sourceId) => {
    return summarizable.filter((source) => source.id === sourceId);
  });

  if (chosen.length !== parsed.data.sourceIds.length) {
    return Response.json(
      { error: 'Every source you summarize must be in this workspace and ready.' },
      { status: 409 },
    );
  }

  const passagesResult = await sampleSummaryPassages(supabase, project.id, chosen);

  if (!passagesResult.ok && passagesResult.kind === 'no-text') {
    return Response.json(
      { error: getNoTextMessage(passagesResult.titles) },
      { status: 422 },
    );
  }

  if (!passagesResult.ok) {
    return Response.json({ error: 'Could not read your sources.' }, { status: 500 });
  }

  const sampled = passagesResult.sources;
  const { result, passageNumbers } = streamSummary({
    sources: sampled,
    abortSignal: request.signal,
  });
  const citations = toPassageCitations(sampled, passageNumbers);

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
