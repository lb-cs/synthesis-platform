import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';

import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Summaries · Synthesis Platform',
};

export default function SummariesPage() {
  return (
    <>
      <PageHeader
        title="Summaries"
        description="Structured summaries of one or more sources, with citations."
      />
      <ComingSoon
        icon={BookOpen}
        title="Summaries are a stretch goal"
        description="Picked up only if the team is ahead of schedule after Sprint 4."
        ticket="CECS491-15"
      />
    </>
  );
}
