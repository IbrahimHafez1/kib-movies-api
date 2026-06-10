import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Small facade over the cache store used to reduce database calls.
 *
 * List endpoints are cached under a namespace version: invalidating a
 * namespace is a single version bump instead of scanning for keys, which
 * stays O(1) no matter how many query permutations were cached.
 */
@Injectable()
export class AppCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.cacheManager.set(key, value, ttlMs);
    return value;
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async getNamespaceVersion(namespace: string): Promise<number> {
    const version = await this.cacheManager.get<number>(this.versionKey(namespace));
    return version ?? 1;
  }

  /** Invalidates every key built with the namespace's current version. */
  async bumpNamespaceVersion(namespace: string): Promise<void> {
    const current = await this.getNamespaceVersion(namespace);
    // Version keys never expire (ttl 0); stale versioned entries expire via their own TTL.
    await this.cacheManager.set(this.versionKey(namespace), current + 1, 0);
  }

  /** Round-trips a value through the store; used by the health check. */
  async ping(): Promise<boolean> {
    const PING_TTL_MS = 5_000;
    await this.cacheManager.set('health:ping', 'ok', PING_TTL_MS);
    return (await this.cacheManager.get('health:ping')) === 'ok';
  }

  private versionKey(namespace: string): string {
    return `${namespace}:version`;
  }
}
