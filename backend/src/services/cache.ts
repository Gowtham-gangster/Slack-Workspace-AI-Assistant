/**
 * In-memory TTL cache service.
 * Lightweight alternative to Redis for single-instance deployments.
 * Each cache entry expires automatically after its TTL.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<any>>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Don't keep Node.js alive just for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * Set a value in the cache with a TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate a specific key.
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Remove all expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache statistics.
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

export const cache = new TTLCache();

// TTL constants (in seconds)
export const TTL = {
  CHANNEL_SUMMARY:  10 * 60,  // 10 minutes
  ACTION_PLANS:     10 * 60,  // 10 minutes
  ANALYTICS:         5 * 60,  //  5 minutes
  SEARCH:            2 * 60,  //  2 minutes
  SLACK_USERS:       5 * 60,  //  5 minutes
  REPORTS:          10 * 60,  // 10 minutes
  INTELLIGENCE:      5 * 60,  //  5 minutes
};

/**
 * Build a consistent cache key.
 */
export function cacheKey(userId: number, ...parts: (string | number)[]): string {
  return `u${userId}:${parts.join(':')}`;
}
