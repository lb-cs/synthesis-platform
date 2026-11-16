import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';

import { ProjectForm } from './project-form';

export const metadata: Metadata = {
  title: 'New workspace · Synthesis Platform',
};

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New workspace"
        description="A workspace holds the sources and conversations for one research topic."
      />
      <ProjectForm />
    </>
  );
}
