/**
 * Mock implementation for CacheService
 * Provides in-memory cache simulation for testing
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class MockCacheService {
  private cache = new Map<string, any>();

  /**
   * Store a value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, {
      value,
      ttl,
      timestamp: Date.now(),
    });
  }

  /**
   * Retrieve a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Simple TTL check
    if (cached.ttl && Date.now() - cached.timestamp > cached.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Remove a value from cache
   */
  async del(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get all keys
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    if (!pattern) {
      return allKeys;
    }

    // Simple pattern matching with wildcards
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  /**
   * Get cache size
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Set multiple values
   */
  async mset(keyValues: Record<string, any>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(keyValues)) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Get multiple values
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, by: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + by;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }

    cached.ttl = ttl;
    cached.timestamp = Date.now();
    return true;
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    const cached = this.cache.get(key);
    if (!cached || !cached.ttl) {
      return -1;
    }

    const elapsed = (Date.now() - cached.timestamp) / 1000;
    const remaining = cached.ttl - elapsed;
    return remaining > 0 ? Math.ceil(remaining) : -2;
  }

  /**
   * Reset mock (for testing)
   */
  resetMock(): void {
    this.cache.clear();
  }
}
