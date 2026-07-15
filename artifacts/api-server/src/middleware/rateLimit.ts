// In-memory login rate limiter: 5 failures -> 5 minute lockout

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function checkRateLimit(username: string): {
  allowed: boolean;
  waitMs?: number;
} {
  const record = attempts.get(username);
  if (!record) return { allowed: true };

  if (record.lockedUntil !== null) {
    const remaining = record.lockedUntil - Date.now();
    if (remaining > 0) {
      return { allowed: false, waitMs: remaining };
    } else {
      // Lock expired — reset
      attempts.delete(username);
      return { allowed: true };
    }
  }

  return { allowed: true };
}

export function recordFailure(username: string): void {
  const record = attempts.get(username) ?? { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
  attempts.set(username, record);
}

export function resetAttempts(username: string): void {
  attempts.delete(username);
}
