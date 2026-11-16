import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Showcase = {
  title: string;
  description: string;
  image: string;
  alt: string;
  height: number;
  points: string[];
};

// Real captures of the app, from `public/landing/`. Each is 2000 px wide; `height` is the real pixel height of that file.
const SHOWCASES: Showcase[] = [
  {
    title: 'All your sources, one workspace',
    description:
      'Upload PDFs, text, and markdown, or paste a web link. Synthesis reads and indexes each one in the background, so your library is ready to question in moments.',
    image: '/landing/sources.jpg',
    height: 1161,
    alt: 'The Sources page: a drop zone for files, a search box, status filters, and a list of ready sources.',
    points: [
      'PDF, .txt, .md, and web links',
      'Live processing status, with one-click retry',
      'Search, filter, rename, and remove',
    ],
  },
  {
    title: 'Answers only from your sources',
    description:
      'Ask in plain language. Synthesis draws only on the passages it finds in your workspace. When your sources do not say, it tells you instead of guessing.',
    image: '/landing/chat.jpg',
    height: 1159,
    alt: 'The workspace chat: a sources panel beside a long answer with numbered citations.',
    points: [
      'Grounded in your own materials, never the open web',
      'Suggested questions to get you started',
      'Conversations are saved with the workspace',
    ],
  },
  {
    title: 'Every claim cited, down to the page',
    description:
      'Every claim carries a citation. Open one and the original PDF appears at the right page with the supporting passage highlighted.',
    image: '/landing/citation.jpg',
    height: 1162,
    alt: 'The source viewer open on page 17 of a PDF, with the cited passages highlighted in yellow.',
    points: [
      'Highlighted passage, not just a filename',
      'Jump to the original file at any time',
    ],
  },
  {
    title: 'Summaries of the sources you choose',
    description:
      'Pick one to five sources and get a structured, cited summary: an overview, key points, and a breakdown by source.',
    image: '/landing/summaries.jpg',
    height: 1159,
    alt: 'The Summaries page: a source picker beside a cited summary with an overview and key points.',
    points: ['Overview, key points, and per-source detail', 'Citations on every point'],
  },
  {
    title: 'Compare sources and surface themes',
    description:
      'Choose two to five sources and a topic to see where they agree, where they differ, and why. Or let Synthesis pull out the key themes across a workspace.',
    image: '/landing/analysis.jpg',
    height: 1159,
    alt: 'The Analysis page comparing two sources on a topic, listing where they agree with citations.',
    points: [
      'Compare tab: agreements and differences',
      'Themes tab: what keeps coming up',
    ],
  },
];

const STEPS = [
  {
    title: 'Create a workspace',
    description: 'One workspace per topic, paper, or class.',
  },
  {
    title: 'Add your sources',
    description: 'Drop in the readings, notes, and links you already have.',
  },
  {
    title: 'Ask and synthesize',
    description: 'Ask questions, compare sources, and build summaries as you go.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center">
        <Badge variant="outline">AI research workspace</Badge>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Research, grounded in your sources.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Synthesis is the research workspace for students and researchers. Add your
            readings, ask anything, and get answers drawn only from what you added, with
            every claim cited to the page behind it.
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
            render={<Link href="#features" />}
            nativeButton={false}
          >
            See what it does
          </Button>
        </div>
        <Screenshot
          src="/landing/chat.jpg"
          height={1159}
          alt="The Synthesis workspace: your sources on the left and a cited answer on the right."
          priority
          className="mt-8 max-w-3xl"
        />
      </section>

      <section id="features" className="scroll-mt-14 border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-20">
          <SectionHeading
            title="Answers you can check"
            description="A general chatbot guesses. Synthesis answers from your materials and shows its work."
          />
          {SHOWCASES.map((showcase, index) => (
            <div
              key={showcase.title}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
            >
              <div
                className={
                  index % 2 === 1
                    ? 'flex flex-col gap-4 lg:order-2'
                    : 'flex flex-col gap-4'
                }
              >
                <h3 className="text-xl font-semibold tracking-tight">{showcase.title}</h3>
                <p className="text-muted-foreground">{showcase.description}</p>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {showcase.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="text-foreground">
                        ·
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Screenshot
                src={showcase.image}
                alt={showcase.alt}
                height={showcase.height}
              />
            </div>
          ))}
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
            Bring your readings. Get answers you can cite.
          </h2>
          <p className="text-muted-foreground">
            Sign in with Google or a one-time email code. No password to remember.
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

function Screenshot({
  src,
  alt,
  height,
  priority = false,
  className = '',
}: {
  src: string;
  alt: string;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={2000}
        height={height}
        priority={priority}
        sizes="(min-width: 1024px) 560px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
