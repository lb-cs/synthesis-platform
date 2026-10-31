'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const REFRESH_INTERVAL_MS = 3_000;

// The worker moves sources along in the database, so while any is still in progress the
// page re-reads them every few seconds. Renders nothing.
export function RefreshWhileProcessing({ isProcessing }: { isProcessing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isProcessing) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isProcessing, router]);

  return null;
}
