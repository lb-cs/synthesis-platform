import type { Metadata } from 'next';
import { FolderOpen, Plus } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Dashboard · Synthesis Platform',
};

// Until the project API lands, one fixed project so the workspace routes are reachable.
const SAMPLE_PROJECT_ID = 'sample';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your research projects, one per topic.">
        <Button render={<Link href="/projects/new" />} nativeButton={false}>
          <Plus />
          New project
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              Sample project
            </CardTitle>
            <CardDescription>
              A placeholder project so the workspace screens can be opened.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">0 sources</p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              render={<Link href={`/projects/${SAMPLE_PROJECT_ID}`} />}
              nativeButton={false}
            >
              Open workspace
            </Button>
          </CardFooter>
        </Card>

        <Link
          href="/projects/new"
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-5" />
          Create a project
        </Link>
      </div>
    </>
  );
}
