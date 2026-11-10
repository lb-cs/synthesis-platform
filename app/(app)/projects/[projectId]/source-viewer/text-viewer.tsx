'use client';

import { useEffect, useRef, useState } from 'react';

import { findPassageRange } from '@/lib/passage-match';

// A plain-text source has no pages, so the viewer shows the whole file with the cited
// passage marked, scrolled into view.
export function TextViewer({
  file,
  passage,
}: {
  file: Blob;
  passage: string | undefined;
}) {
  const [text, setText] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let isCurrent = true;

    void file.text().then((value) => {
      if (isCurrent) {
        setText(value);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [file]);

  const range = text !== null && passage ? findPassageRange(text, passage) : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, [range]);

  if (text === null) {
    return <p className="text-sm text-muted-foreground">Opening source…</p>;
  }

  if (!range) {
    return (
      <>
        <p className="mb-3 text-xs text-muted-foreground">
          The exact passage could not be marked, so the whole file is shown.
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </>
    );
  }

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {text.slice(0, range.start)}
      <mark ref={markRef} className="rounded-xs bg-yellow-300/60 text-black">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </p>
  );
}
