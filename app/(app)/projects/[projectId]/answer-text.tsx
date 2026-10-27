'use client';

import { createContext, use, useMemo, type ComponentProps } from 'react';
import type { AnimateOptions, Components } from 'streamdown';

import {
  getCitationNumber,
  getCitedSources,
  getSourceFileHref,
  linkCitations,
  type CitedSource,
} from '@/lib/citations';
import { MessageResponse } from '@/components/ai-elements/message';
import { badgeVariants } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Blur hides tokens that land in one batch better than a plain fade.
const STREAM_ANIMATION: AnimateOptions = {
  animation: 'blurIn',
  duration: 250,
  easing: 'ease-out',
};

// Streamdown's half-typed link while `[1` waits for its `]`.
const INCOMPLETE_LINK_HREF = 'streamdown:incomplete-link';

type CitationContextValue = {
  projectId: string;
  sourcesByNumber: Map<number, CitedSource>;
};

const CitationContext = createContext<CitationContextValue | null>(null);

function CitationAnchor({ href, children }: ComponentProps<'a'>) {
  const citations = use(CitationContext);

  // Hidden until the marker completes, so a stray "[1" never flashes in the answer.
  if (href === INCOMPLETE_LINK_HREF) {
    return null;
  }

  const number = getCitationNumber(href);

  if (number === null || !citations) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        {children}
      </a>
    );
  }

  const source = citations.sourcesByNumber.get(number);

  // A number the model made up: show it as written rather than a broken link.
  if (!source) {
    return <>[{children}]</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        className={badgeVariants({
          variant: 'outline',
          className: 'mx-0.5 align-text-top',
        })}
        render={
          <a
            href={getSourceFileHref(citations.projectId, source.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open source ${source.number}: ${source.title}`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{source.title}</TooltipContent>
    </Tooltip>
  );
}

// Module-level so Streamdown sees the same object every render and keeps its blocks.
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => {
    return <CitationAnchor href={href}>{children}</CitationAnchor>;
  },
};

// An assistant answer: [n] markers become links to the source, cited sources listed below.
export function AnswerText({
  projectId,
  text,
  sources,
  isStreaming,
}: {
  projectId: string;
  text: string;
  sources: CitedSource[];
  isStreaming: boolean;
}) {
  const citations = useMemo(() => {
    const sourcesByNumber = new Map(sources.map((source) => [source.number, source]));

    return { projectId, sourcesByNumber };
  }, [projectId, sources]);

  const citedSources = getCitedSources(text, sources);
  const showCitedSources = !isStreaming && citedSources.length > 0;

  return (
    <CitationContext value={citations}>
      <MessageResponse
        className="leading-relaxed"
        components={MARKDOWN_COMPONENTS}
        animated={STREAM_ANIMATION}
        caret="block"
        isAnimating={isStreaming}
      >
        {linkCitations(text)}
      </MessageResponse>

      {showCitedSources && (
        <ol className="flex animate-in flex-col gap-1 text-xs text-muted-foreground duration-300 fade-in-0">
          {citedSources.map((source) => (
            <li key={source.id}>
              <a
                href={getSourceFileHref(projectId, source.id)}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                [{source.number}] {source.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </CitationContext>
  );
}
