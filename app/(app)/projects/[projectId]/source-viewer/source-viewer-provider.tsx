'use client';

import { createContext, use, useMemo, useState } from 'react';

import type { CitedSource } from '@/lib/citations';

import { SourceViewerSheet } from './source-viewer-sheet';

type SourceViewerValue = {
  openCitation: (citation: CitedSource) => void;
};

const SourceViewerContext = createContext<SourceViewerValue | null>(null);

/** Opens a citation in the viewer; null outside a project, where citations open the file. */
export function useSourceViewer(): SourceViewerValue | null {
  return use(SourceViewerContext);
}

// One viewer for the whole project, so the chat and Compare open citations the same way.
export function SourceViewerProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [citation, setCitation] = useState<CitedSource | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(() => {
    return {
      openCitation(next: CitedSource) {
        setCitation(next);
        setIsOpen(true);
      },
    };
  }, []);

  return (
    <SourceViewerContext value={value}>
      {children}
      <SourceViewerSheet
        projectId={projectId}
        citation={citation}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </SourceViewerContext>
  );
}
