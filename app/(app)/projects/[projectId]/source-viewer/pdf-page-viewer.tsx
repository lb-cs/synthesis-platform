'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs, type TextContent } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { findPassageInItems, type TextRange } from '@/lib/passage-match';
import { Button } from '@/components/ui/button';

// react-pdf needs the worker set in the module that renders the document.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// A PDF page is always white, so the marker is a fixed yellow rather than a theme token.
// The text layer's text is transparent, so the mark must not bring its own color back.
const MARK_OPEN_TAG = '<mark class="rounded-xs bg-yellow-300/60 text-transparent">';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

type PassageStatus = 'searching' | 'found' | 'missing';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

// The text layer takes HTML for each text item, so the cited part of an item is wrapped
// in a mark and everything else is escaped.
function renderItem(str: string, range: TextRange | undefined): string {
  if (!range) {
    return escapeHtml(str);
  }

  const before = escapeHtml(str.slice(0, range.start));
  const marked = escapeHtml(str.slice(range.start, range.end));
  const after = escapeHtml(str.slice(range.end));

  return `${before}${MARK_OPEN_TAG}${marked}</mark>${after}`;
}

// One page of a PDF, opened at the cited page with the cited passage marked. The other
// pages are a button away.
export default function PdfPageViewer({
  file,
  pageNumber,
  passage,
}: {
  file: Blob;
  pageNumber: number;
  passage: string | undefined;
}) {
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [highlights, setHighlights] = useState<Map<number, TextRange> | null>(null);
  const [status, setStatus] = useState<PassageStatus>(passage ? 'searching' : 'missing');

  const isCitedPage = currentPage === pageNumber;

  // The page is drawn at the width of the sheet, and redrawn when it resizes.
  useEffect(() => {
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [container]);

  const customTextRenderer = useMemo(() => {
    if (!highlights) {
      return undefined;
    }

    return ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      return renderItem(str, highlights.get(itemIndex));
    };
  }, [highlights]);

  function handleTextLoaded({ items }: TextContent) {
    if (!isCitedPage || !passage) {
      return;
    }

    const strings = items.map((item) => ('str' in item ? item.str : ''));
    const found = findPassageInItems(strings, passage);

    setHighlights(found);
    setStatus(found ? 'found' : 'missing');
  }

  function scrollToMark() {
    container?.querySelector('mark')?.scrollIntoView({ block: 'center' });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          <ChevronLeft />
        </Button>
        <p className="text-sm text-muted-foreground">
          Page {currentPage}
          {pageCount !== null && ` of ${pageCount}`}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={pageCount === null || currentPage >= pageCount}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          <ChevronRight />
        </Button>
      </div>

      {isCitedPage && status === 'missing' && (
        <p className="text-xs text-muted-foreground">
          The exact passage could not be marked, so the whole page is shown.
        </p>
      )}

      <div ref={setContainer} className="overflow-hidden rounded-md border bg-white">
        <Document
          file={file}
          suspense={false}
          loading={<p className="p-4 text-sm text-muted-foreground">Opening source…</p>}
          error={
            <p className="p-4 text-sm text-destructive">
              This PDF could not be shown. Open the file in a new tab instead.
            </p>
          }
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        >
          {width > 0 && (
            <Page
              pageNumber={currentPage}
              width={width}
              suspense={false}
              customTextRenderer={isCitedPage ? customTextRenderer : undefined}
              onGetTextSuccess={handleTextLoaded}
              onRenderTextLayerSuccess={scrollToMark}
            />
          )}
        </Document>
      </div>
    </div>
  );
}
