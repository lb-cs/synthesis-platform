/**
 * The Themes tab (UC-19): whether a project can be read for themes, and the sample of
 * passages each ready source contributes. Type-only imports (plus pure `lib/passages`),
 * so the page and the route apply the same limits.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SourcePassages } from '@/lib/ai';
import { getReadySources, groupPassages, type PassageSource } from '@/lib/passages';
import type { Source } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

export const MIN_THEME_SOURCES = 2;
export const MAX_THEME_SOURCES = 15;

// Spread through each source. At the maximum that is 120 passages, about 30k tokens.
export const PASSAGES_PER_SOURCE = 8;

/** Whether Themes can run, discriminated on `kind`. */
export type ThemesReadiness =
  | { kind: 'ready'; sources: PassageSource[] }
  | { kind: 'too-few'; readyCount: number }
  | { kind: 'too-large'; readyCount: number };

export type ThemePassagesResult =
  { ok: true; sources: SourcePassages[] } | { ok: false; kind: 'database-error' };

type Client = SupabaseClient<Database>;

/** Themes reads every ready source, so the limits apply to the whole project. */
export function getThemesReadiness(sources: Source[]): ThemesReadiness {
  const ready = getReadySources(sources);

  if (ready.length < MIN_THEME_SOURCES) {
    return { kind: 'too-few', readyCount: ready.length };
  }

  if (ready.length > MAX_THEME_SOURCES) {
    return { kind: 'too-large', readyCount: ready.length };
  }

  return { kind: 'ready', sources: ready };
}

/** One sentence on why Themes can't run, for an error response or an alert. */
export function getThemesUnavailableMessage(
  readiness: Exclude<ThemesReadiness, { kind: 'ready' }>,
): string {
  if (readiness.kind === 'too-few') {
    return `Themes needs at least ${MIN_THEME_SOURCES} ready sources. This project has ${readiness.readyCount}.`;
  }

  return `This project is too large for Themes: it reads up to ${MAX_THEME_SOURCES} ready sources at once, and this project has ${readiness.readyCount}.`;
}

/**
 * Up to PASSAGES_PER_SOURCE chunks spread through each source, grouped in the order
 * `sources` gives. Runs as the signed-in user, so RLS scopes it.
 */
export async function sampleThemePassages(
  supabase: Client,
  projectId: string,
  sources: PassageSource[],
): Promise<ThemePassagesResult> {
  const { data, error } = await supabase.rpc('sample_source_chunks', {
    project_id: projectId,
    chunks_per_source: PASSAGES_PER_SOURCE,
  });

  if (error) {
    return { ok: false, kind: 'database-error' };
  }

  return { ok: true, sources: groupPassages(sources, data) };
}
