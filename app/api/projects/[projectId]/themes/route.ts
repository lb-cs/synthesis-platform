import {
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type ToolSet,
} from 'ai';

import { streamThemes } from '@/lib/ai';
import type { ChatUIMessage } from '@/lib/citations';
import { toPassageCitations } from '@/lib/passages';
import { getProject } from '@/lib/projects';
import { listSources } from '@/lib/sources';
import { createClient, getSupabaseUser } from '@/lib/supabase/server';
import {
  getThemesReadiness,
  getThemesUnavailableMessage,
  sampleThemePassages,
} from '@/lib/themes';

import { projectIdSchema } from '@/app/api/projects/schema';

type Context = RouteContext<'/api/projects/[projectId]/themes'>;

const AI_UNAVAILABLE = 'The AI service is unavailable right now. Try again in a moment.';

// Streams the key themes across every ready source, with cited evidence. Nothing is saved.
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

  const project = projectResult.project;
  const sourcesResult = await listSources(supabase, project.id);

  if (!sourcesResult.ok) {
    return Response.json({ error: 'Could not load sources.' }, { status: 500 });
  }

  const readiness = getThemesReadiness(sourcesResult.sources);

  if (readiness.kind === 'too-few') {
    return Response.json(
      { error: getThemesUnavailableMessage(readiness) },
      { status: 409 },
    );
  }

  if (readiness.kind === 'too-large') {
    return Response.json(
      { error: getThemesUnavailableMessage(readiness) },
      { status: 422 },
    );
  }

  const passagesResult = await sampleThemePassages(
    supabase,
    project.id,
    readiness.sources,
  );

  if (!passagesResult.ok) {
    return Response.json({ error: 'Could not read your sources.' }, { status: 500 });
  }

  const sampled = passagesResult.sources;
  const { result, passageNumbers } = streamThemes({
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
