import Image from 'next/image';

import { cn } from '@/lib/utils';

/** The brand mark: dark strokes on light themes, the reversed version on dark ones. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/brand/logo-mark.svg"
        alt=""
        width={64}
        height={64}
        className={cn('size-7 dark:hidden', className)}
      />
      <Image
        src="/brand/logo-mark-reversed.svg"
        alt=""
        width={64}
        height={64}
        className={cn('hidden size-7 dark:block', className)}
      />
    </>
  );
}
