import { useEffect, useState } from 'react';

import { getSourceFileHref } from '@/lib/citations';

export type SourceFileState =
  | { kind: 'loading' }
  | { kind: 'ready'; file: Blob }
  | { kind: 'error'; message: string };

const LOAD_ERROR =
  'Could not open this source. Try again, or open the file in a new tab.';

/** Downloads a source's file once, so the viewer can show any page of it without refetching. */
export function useSourceFile(projectId: string, sourceId: string): SourceFileState {
  const [state, setState] = useState<SourceFileState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function loadFile() {
      // fetch rejects only on network failure; a failed status is checked below.
      try {
        const response = await fetch(getSourceFileHref(projectId, sourceId), {
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({ kind: 'error', message: LOAD_ERROR });
          return;
        }

        setState({ kind: 'ready', file: await response.blob() });
      } catch {
        // Closing the viewer aborts the request, and nobody is left to show an error to.
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: LOAD_ERROR });
        }
      }
    }

    void loadFile();

    return () => controller.abort();
  }, [projectId, sourceId]);

  return state;
}
