import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';

import { ProjectForm } from './project-form';

export const metadata: Metadata = {
  title: 'New project · Synthesis Platform',
};

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New project"
        description="A project holds the sources and conversations for one research topic."
      />
      <ProjectForm />
    </>
  );
}
