import { Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { title: 'Features', href: '#features' },
  { title: 'How it works', href: '#how-it-works' },
];

/** The signed-out top bar; signed-in screens use the app shell's sidebar instead. */
export function SiteHeader({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/home" className="flex items-center gap-2 font-medium">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          Synthesis
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              render={<Link href={link.href} />}
              nativeButton={false}
            >
              {link.title}
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isSignedIn ? (
            <Button size="sm" render={<Link href="/dashboard" />} nativeButton={false}>
              Open dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/login" />}
                nativeButton={false}
              >
                Sign in
              </Button>
              <Button size="sm" render={<Link href="/login" />} nativeButton={false}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
