import type { Metadata } from 'next';
import { FolderOpen, FolderPlus, Plus } from 'lucide-react';
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { listProjects } from '../projects/actions';

export const metadata: Metadata = {
  title: 'Dashboard · Synthesis Platform',
};

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <>
      <PageHeader title="Dashboard" description="Your research projects, one per topic.">
        <Button render={<Link href="/projects/new" />} nativeButton={false}>
          <Plus />
          New project
        </Button>
      </PageHeader>

      {projects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlus />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              Create a project to start collecting sources and asking questions.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/projects/new" />} nativeButton={false}>
              <Plus />
              Create a project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground" />
                  {project.title}
                </CardTitle>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">0 sources</p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  render={<Link href={`/projects/${project.id}`} />}
                  nativeButton={false}
                >
                  Open workspace
                </Button>
              </CardFooter>
            </Card>
          ))}

          <Link
            href="/projects/new"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-5" />
            Create a project
          </Link>
        </div>
      )}
    </>
  );
}
