/**
 * Calculates the score for a single answer.
 *
 * Rules (from BUILD_DIRECTIVE §10):
 * - Correctness first, speed second.
 * - Wrong or no answer before deadline = 0 points.
 * - < 1s = 200, 1-2s = 180, 2-4s = 160, 4-6s = 140, 6-8s = 120, 8-10s = 100
 *
 * LOCKED (Deployment Readiness Addendum §16): this bracket curve is the shipping
 * formula for launch. Do not re-open. Any tuning happens post-launch as a
 * deliberate, versioned change.
 */

export function calculateScore(
  isCorrect: boolean,
  responseMs: number,
  deadlineMs: number
): number {
  if (!isCorrect) return 0;
  if (responseMs > deadlineMs) return 0; // Though this shouldn't happen if server rejects late answers

  if (responseMs < 1000) return 200;
  if (responseMs < 2000) return 180;
  if (responseMs < 4000) return 160;
  if (responseMs < 6000) return 140;
  if (responseMs < 8000) return 120;
  if (responseMs <= 10000) return 100;
  
  return 100; // Fallback for very slow but accepted (e.g., 15s/30s timers)
}
