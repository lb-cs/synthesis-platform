import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Synthesis Platform
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Next.js, Tailwind CSS, and shadcn/ui foundation. Nothing else is wired
          up yet.
        </p>
      </div>
      <div className="flex gap-3">
        <Button render={<Link href="/example" />}>Example route</Button>
        <Button variant="outline" render={<Link href="/api/health" />}>
          /api/health
        </Button>
      </div>
    </main>
  );
}
