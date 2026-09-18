import type { Metadata } from 'next';
import { FileText, Link2, Upload } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export const metadata: Metadata = {
  title: 'Sources · Synthesis Platform',
};

export default function SourcesPage() {
  return (
    <>
      <PageHeader title="Sources" description="Files and links the AI can draw on.">
        {/* Not wired up: web and YouTube links are a stretch goal (CECS491-18). */}
        <Button variant="outline" disabled>
          <Link2 />
          Add link
          <Badge variant="secondary">Stretch</Badge>
        </Button>
      </PageHeader>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Upload className="size-6 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Drop PDF or text files here</p>
            <p className="text-sm text-muted-foreground">
              Files are stored, parsed, and queued for processing.
            </p>
          </div>
          {/* Not wired up: upload lands with CECS491-10. */}
          <Button variant="secondary" disabled>
            Browse files
          </Button>
        </CardContent>
      </Card>

      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No sources yet</EmptyTitle>
          <EmptyDescription>
            Uploaded sources will be listed here with their processing status.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
