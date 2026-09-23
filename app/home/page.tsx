import { ArrowRight, BookOpen, FileText, Quote, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const FEATURES: Feature[] = [
  {
    title: 'All your sources, one project',
    description:
      'Upload PDFs, text files, and transcripts. Web pages and YouTube links are next.',
    icon: FileText,
  },
  {
    title: 'Answers only from your sources',
    description:
      'The AI never reaches outside what you added. If it is not there, it says so.',
    icon: ShieldCheck,
  },
  {
    title: 'Every claim cited',
    description: 'Click a citation to jump straight to the passage and page behind it.',
    icon: Quote,
  },
  {
    title: 'Summaries and themes',
    description: 'Summarize a stack of sources, compare ideas, and pull out key themes.',
    icon: BookOpen,
  },
];

const STEPS = [
  { title: 'Create a project', description: 'One project per topic, paper, or class.' },
  {
    title: 'Add your sources',
    description: 'Drop in the readings, notes, and transcripts you already have.',
  },
  {
    title: 'Ask and synthesize',
    description: 'Ask questions, get cited answers, and build summaries as you go.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center">
        <Badge variant="outline">CECS 491 · Early preview</Badge>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Research, grounded in your sources.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            A research workspace for students and researchers. Upload your materials, ask
            questions, and get answers drawn only from what you added — every claim cited.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" render={<Link href="/login" />} nativeButton={false}>
            Get started
            <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="#how-it-works" />}
            nativeButton={false}
          >
            How it works
          </Button>
        </div>
        <WorkspacePreview />
      </section>

      <section id="features" className="scroll-mt-14 border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
          <SectionHeading
            title="An AI that stays on your page"
            description="Unlike a general chatbot, it answers from your materials and nothing else."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 size-5 text-muted-foreground" />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-14 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
          <SectionHeading
            title="How it works"
            description="Three steps from a pile of readings to a cited answer."
          />
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Start your first project
          </h2>
          <p className="text-muted-foreground">
            Sign in with your email — no password needed.
          </p>
          <Button render={<Link href="/login" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

// Stand-in for a real screenshot: the workspace's sources-plus-chat split, in skeletons.
function WorkspacePreview() {
  return (
    <div
      aria-hidden
      className="mt-8 grid w-full max-w-4xl grid-cols-3 gap-4 rounded-xl border bg-card p-4 text-left shadow-sm"
    >
      <div className="flex flex-col gap-3 border-r pr-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      <div className="col-span-2 flex flex-col gap-3">
        <Skeleton className="h-10 w-2/3 self-end" />
        <Skeleton className="h-20 w-5/6" />
        <Skeleton className="h-10 w-1/2 self-end" />
        <Skeleton className="mt-auto h-9 w-full" />
      </div>
    </div>
  );
}
