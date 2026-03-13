// ============================================
// Offline Cache — AsyncStorage-based caching
// ============================================
// Caches API responses locally for offline access
// and faster subsequent loads.
// ============================================

import * as SecureStore from 'expo-secure-store';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_PREFIX = 'ht_cache_';
const MAX_VALUE_SIZE = 2048; // SecureStore limit per key

/**
 * Simple in-memory fallback for large values
 */
const memoryCache = new Map<string, CacheEntry<any>>();

class OfflineCache {
  /**
   * Set a cache entry
   */
  async set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    const serialized = JSON.stringify(entry);

    if (serialized.length <= MAX_VALUE_SIZE) {
      try {
        await SecureStore.setItemAsync(CACHE_PREFIX + key, serialized);
      } catch {
        // Fallback to memory if SecureStore fails
        memoryCache.set(key, entry);
      }
    } else {
      // Large values go to memory cache only
      memoryCache.set(key, entry);
    }
  }

  /**
   * Get a cache entry (returns null if expired or missing)
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory first
    const memEntry = memoryCache.get(key);
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) {
        return memEntry.data as T;
      }
      memoryCache.delete(key);
    }

    // Check SecureStore
    try {
      const raw = await SecureStore.getItemAsync(CACHE_PREFIX + key);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() >= entry.expiresAt) {
        await SecureStore.deleteItemAsync(CACHE_PREFIX + key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Get cached data, or fetch fresh data if cache miss
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<{ data: T | null; fromCache: boolean }> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    // Fetch fresh
    try {
      const fresh = await fetcher();
      if (fresh !== null) {
        await this.set(key, fresh, ttlMs);
      }
      return { data: fresh, fromCache: false };
    } catch {
      return { data: null, fromCache: false };
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      await SecureStore.deleteItemAsync(CACHE_PREFIX + key);
    } catch {
      // ignore
    }
  }

  /**
   * Invalidate all entries matching a prefix
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    // Memory cache
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
    // Note: SecureStore doesn't support listing keys,
    // so we rely on TTL for automatic cleanup
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    memoryCache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      memoryEntries: memoryCache.size,
    };
  }
}

// Common cache keys
export const CacheKeys = {
  HOME_EXPERIENCES: 'home_experiences',
  HOME_FEATURED: 'home_featured',
  TRENDING_SEARCH: 'trending_search',
  USER_PROFILE: 'user_profile',
  USER_FAVORITES: 'user_favorites',
  BOOKINGS: 'bookings',
  NOTIFICATIONS: 'notifications',
  experienceDetail: (id: string) => `experience_${id}`,
  guideProfile: (id: string) => `guide_${id}`,
} as const;

export const offlineCache = new OfflineCache();
export default offlineCache;
