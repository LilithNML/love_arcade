'use client';

import { useEffect, useRef } from 'react';

export function useSyncWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker('/workers/sync-worker.js', { type: 'classic' });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return workerRef;
}
