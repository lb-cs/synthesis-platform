import { SourceViewerProvider } from './source-viewer/source-viewer-provider';

// Every screen of a project can show citations, so they share one source viewer.
export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<'/projects/[projectId]'>) {
  const { projectId } = await params;

  return <SourceViewerProvider projectId={projectId}>{children}</SourceViewerProvider>;
}
