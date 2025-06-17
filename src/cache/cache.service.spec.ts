import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { LogService } from '../logging/log.service';

describe('CacheService', () => {
  let service: CacheService;
  // Используем префикс _ для неиспользуемых переменных
  let _logService: LogService;

  beforeEach(async () => {
    const logServiceMock = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: LogService,
          useValue: logServiceMock,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    _logService = module.get<LogService>(LogService);
  });

  afterEach(async () => {
    await service.clear();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent keys', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return default value for non-existent keys when provided', async () => {
      const defaultValue = 'default';
      const result = await service.get('nonexistent', defaultValue);
      expect(result).toBe(defaultValue);
    });

    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { test: 'value' };

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should respect TTL and expire items', async () => {
      const key = 'short-lived';
      const value = 'will-expire';

      // Set with 1 second TTL
      await service.set(key, value, 1);

      // Should exist immediately
      expect(await service.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be gone
      expect(await service.get(key)).toBeNull();
    });
  });

  describe('has', () => {
    it('should return false for non-existent keys', async () => {
      expect(await service.has('nonexistent')).toBe(false);
    });

    it('should return true for existing keys', async () => {
      const key = 'exists';
      await service.set(key, 'value');
      expect(await service.has(key)).toBe(true);
    });

    it('should return false for expired keys', async () => {
      const key = 'will-expire';
      await service.set(key, 'value', 1);

      // Should exist immediately
      expect(await service.has(key)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be gone
      expect(await service.has(key)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove items from cache', async () => {
      const key = 'to-delete';
      await service.set(key, 'value');

      expect(await service.has(key)).toBe(true);

      await service.delete(key);

      expect(await service.has(key)).toBe(false);
      expect(await service.get(key)).toBeNull();
    });

    it('should return true when deleting existing item', async () => {
      const key = 'to-delete';
      await service.set(key, 'value');

      const result = await service.delete(key);

      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent item', async () => {
      const result = await service.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all items from cache', async () => {
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      await service.clear();

      expect(await service.has('key1')).toBe(false);
      expect(await service.has('key2')).toBe(false);
    });

    it('should reset hit/miss counters', async () => {
      // Add some items and access them to increment counters
      await service.set('key1', 'value1');
      await service.get('key1');
      await service.get('nonexistent');

      // Get stats before clearing
      const statsBefore = await service.getStats();
      expect(statsBefore.hits).toBeGreaterThan(0);
      expect(statsBefore.misses).toBeGreaterThan(0);

      // Clear cache
      await service.clear();

      // Get stats after clearing
      const statsAfter = await service.getStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return all non-expired keys', async () => {
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      const keys = await service.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });

    it('should not return expired keys', async () => {
      await service.set('permanent', 'value1');
      await service.set('temporary', 'value2', 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const keys = await service.keys();

      expect(keys).toContain('permanent');
      expect(keys).not.toContain('temporary');
      expect(keys.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should track hits and misses correctly', async () => {
      // Initial stats should have 0 hits and misses
      const initialStats = await service.getStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);

      // Add a key and access it (hit)
      await service.set('key1', 'value1');
      await service.get('key1');

      // Access non-existent key (miss)
      await service.get('nonexistent');

      // Check stats
      const stats = await service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('getInfo', () => {
    it('should return cache information', () => {
      const info = service.getInfo();

      expect(info).toHaveProperty('type', 'SimpleMemoryCache');
      expect(info).toHaveProperty('version', '1.0.0');
      expect(info).toHaveProperty('description');
      expect(info).toHaveProperty('stats');
      expect(info).toHaveProperty('settings');
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest item when max size is reached', async () => {
      // Переопределяем maxItems для тестирования
      Object.defineProperty(service, 'maxItems', { value: 5 });

      // We'll use a small subset for testing
      const testSize = 5;

      // Fill cache with testSize items
      for (let i = 0; i < testSize; i++) {
        // Set with different expiration times to ensure predictable eviction
        await service.set(`key${i}`, `value${i}`, 60 + i);
      }

      // All items should be present
      for (let i = 0; i < testSize; i++) {
        expect(await service.has(`key${i}`)).toBe(true);
      }

      // Add one more item, which should cause eviction of the oldest (key0)
      await service.set('new-key', 'new-value');

      // key0 should be evicted (has earliest expiration)
      expect(await service.has('key0')).toBe(false);

      // Other keys should still be present
      for (let i = 1; i < testSize; i++) {
        expect(await service.has(`key${i}`)).toBe(true);
      }

      // New key should be present
      expect(await service.has('new-key')).toBe(true);
    });
  });
});
