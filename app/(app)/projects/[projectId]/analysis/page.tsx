import type { Metadata } from 'next';
import { Layers } from 'lucide-react';

import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Analysis · Synthesis Platform',
};

export default function AnalysisPage() {
  return (
    <>
      <PageHeader
        title="Analysis"
        description="Compare concepts and surface themes across the sources in this project."
      />
      <ComingSoon
        icon={Layers}
        title="Cross-source analysis is a stretch goal"
        description="Picked up only if the team is ahead of schedule."
        ticket="CECS491-16"
      />
    </>
  );
}
