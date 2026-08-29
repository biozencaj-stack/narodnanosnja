import { LRUCache } from "lru-cache";

interface RateLimitOptions {
  max?: number; // Maximum number of entries in cache
  ttl?: number; // Time to live in milliseconds
}

const defaultOptions: RateLimitOptions = {
  max: 500,
  ttl: 60 * 1000, // 1 minute
};

const rateLimit = new LRUCache<string, number>({
  max: defaultOptions.max!,
  ttl: defaultOptions.ttl!,
});

/**
 * Check if the request is within rate limit
 * @param key - Unique identifier (usually IP address)
 * @param limit - Maximum requests per TTL period
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(key: string, limit: number = 10): boolean {
  const current = rateLimit.get(key) || 0;

  if (current >= limit) {
    return false; // Limit reached
  }

  rateLimit.set(key, current + 1);
  return true;
}

/**
 * Get remaining requests for a key
 */
export function getRemainingRequests(key: string, limit: number = 10): number {
  const current = rateLimit.get(key) || 0;
  return Math.max(0, limit - current);
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  rateLimit.delete(key);
}
