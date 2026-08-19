import { useEffect, useState } from 'react';

/**
 * Derives remaining seconds from a server-provided `endsAt` epoch (ms).
 * Because it recomputes against the wall clock rather than counting down
 * locally, brief tab-throttling or reconnects self-correct on the next tick.
 */
export function useSyncedTimer(endsAt: number | null): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return;
    
    // Update immediately to catch up in case the render was delayed
    setNow(Date.now());
    
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200);
    
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) return 0;
  return Math.ceil(Math.max(0, endsAt - now) / 1000);
}
