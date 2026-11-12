'use client';

import dynamic from 'next/dynamic';

import { getCitationHref, type CitedSource } from '@/lib/citations';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { TextViewer } from './text-viewer';
import { useSourceFile } from './use-source-file';

function ViewerMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// pdf.js needs the browser, so the PDF viewer loads there only, and only when opened.
const PdfPageViewer = dynamic(() => import('./pdf-page-viewer'), {
  ssr: false,
  loading: () => <ViewerMessage>Opening source…</ViewerMessage>,
});

function SourceViewerBody({
  projectId,
  citation,
}: {
  projectId: string;
  citation: CitedSource;
}) {
  const fileState = useSourceFile(projectId, citation.id);

  if (fileState.kind === 'loading') {
    return <ViewerMessage>Opening source…</ViewerMessage>;
  }

  if (fileState.kind === 'error') {
    return <p className="text-sm text-destructive">{fileState.message}</p>;
  }

  // Only a PDF has pages; a text file's chunks have none.
  if (citation.pageNumber) {
    return (
      <PdfPageViewer
        file={fileState.file}
        pageNumber={citation.pageNumber}
        passage={citation.passage}
      />
    );
  }

  return <TextViewer file={fileState.file} passage={citation.passage} />;
}

// A web page isn't stored, only its extracted text, so the cited passage is the view.
function WebPassage({ passage }: { passage: string | undefined }) {
  if (!passage) {
    return <ViewerMessage>Open the web page to read this source.</ViewerMessage>;
  }

  return (
    <blockquote className="border-l-2 border-yellow-400 pl-4 text-sm leading-relaxed whitespace-pre-wrap">
      {passage}
    </blockquote>
  );
}

// UC-20: a citation opens its source here, at the cited page, with the passage marked.
export function SourceViewerSheet({
  projectId,
  citation,
  open,
  onOpenChange,
}: {
  projectId: string;
  citation: CitedSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!citation) {
    return null;
  }

  const isWebPage = Boolean(citation.url);
  const description = citation.pageNumber
    ? `Page ${citation.pageNumber}`
    : 'Cited passage';
  const openLabel = isWebPage ? 'Open the web page' : 'Open the original file';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{citation.title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {isWebPage ? (
            <WebPassage passage={citation.passage} />
          ) : (
            <SourceViewerBody
              key={`${citation.id}-${citation.number}`}
              projectId={projectId}
              citation={citation}
            />
          )}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            render={
              <a
                href={getCitationHref(projectId, citation)}
                target="_blank"
                rel="noreferrer"
              />
            }
            nativeButton={false}
          >
            {openLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
