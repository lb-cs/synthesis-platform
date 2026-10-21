import { getCitedSources, splitCitations, type CitedSource } from '@/lib/citations';
import { Badge } from '@/components/ui/badge';

export function getSourceFileHref(projectId: string, sourceId: string): string {
  return `/api/projects/${projectId}/sources/${sourceId}/file`;
}

function CitationLink({ projectId, source }: { projectId: string; source: CitedSource }) {
  return (
    <Badge
      variant="outline"
      className="mx-0.5 align-text-top"
      render={
        <a
          href={getSourceFileHref(projectId, source.id)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source ${source.number}: ${source.title}`}
          title={source.title}
        />
      }
    >
      {source.number}
    </Badge>
  );
}

// An assistant answer: [n] markers become links to the source, cited sources listed below.
export function AnswerText({
  projectId,
  text,
  sources,
}: {
  projectId: string;
  text: string;
  sources: CitedSource[];
}) {
  const sourcesByNumber = new Map(sources.map((source) => [source.number, source]));
  const segments = splitCitations(text);
  const citedSources = getCitedSources(text, sources);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map((segment, index) => {
          if (segment.kind === 'text') {
            return segment.text;
          }

          const source = sourcesByNumber.get(segment.number);

          // A number the model made up: show it as written rather than a broken link.
          if (!source) {
            return `[${segment.number}]`;
          }

          return <CitationLink key={index} projectId={projectId} source={source} />;
        })}
      </p>
      {citedSources.length > 0 && (
        <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
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
    </div>
  );
}
