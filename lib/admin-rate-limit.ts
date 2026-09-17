interface AttemptRecord {
  failures: number[];
}

const attempts = new Map<string, AttemptRecord>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

function recentFailures(ip: string, now = Date.now()): number[] {
  const record = attempts.get(ip);
  if (!record) return [];

  const failures = record.failures.filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (failures.length === 0) {
    attempts.delete(ip);
  } else {
    attempts.set(ip, { failures });
  }

  return failures;
}

export function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const failures = recentFailures(ip, now);

  if (failures.length < MAX_FAILURES) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAt = failures[0] + WINDOW_MS;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
  };
}

export function recordLoginFailure(ip: string): void {
  const failures = recentFailures(ip);
  failures.push(Date.now());
  attempts.set(ip, { failures });
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}
