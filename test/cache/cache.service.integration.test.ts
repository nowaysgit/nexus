import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';

describe('CacheService Tests', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    cacheService = moduleRef.get<CacheService>(CacheService);
    await cacheService.clear();
  });

  afterEach(async () => {
    await cacheService.clear();
  });

  it('should create cache service instance', () => {
    expect(cacheService).toBeDefined();
  });

  it('should set and get cached value', async () => {
    const testKey = 'test-key';
    const testValue = { data: 'test-data', number: 42 };

    await cacheService.set(testKey, testValue);
    const cachedValue = await cacheService.get(testKey);

    expect(cachedValue).toEqual(testValue);
  });

  it('should handle TTL expiration', async () => {
    const testKey = 'ttl-test-key';
    const testValue = 'ttl-test-value';
    const ttl = 1;

    await cacheService.set(testKey, testValue, ttl);

    let cachedValue = await cacheService.get(testKey);
    expect(cachedValue).toBe(testValue);

    await new Promise(resolve => setTimeout(resolve, 1500));

    cachedValue = await cacheService.get(testKey);
    expect(cachedValue).toBeNull();
  });

  it('should delete cached value', async () => {
    const testKey = 'delete-test-key';
    const testValue = 'delete-test-value';

    await cacheService.set(testKey, testValue);

    let cachedValue = await cacheService.get(testKey);
    expect(cachedValue).toBe(testValue);

    await cacheService.del(testKey);

    cachedValue = await cacheService.get(testKey);
    expect(cachedValue).toBeNull();
  });

  it('should clear all cache', async () => {
    await cacheService.set('key1', 'value1');
    await cacheService.set('key2', 'value2');
    await cacheService.set('key3', 'value3');

    expect(await cacheService.get('key1')).toBe('value1');
    expect(await cacheService.get('key2')).toBe('value2');
    expect(await cacheService.get('key3')).toBe('value3');

    await cacheService.clear();

    expect(await cacheService.get('key1')).toBeNull();
    expect(await cacheService.get('key2')).toBeNull();
    expect(await cacheService.get('key3')).toBeNull();
  });

  it('should handle complex objects in cache', async () => {
    type ComplexObject = {
      id: number;
      name: string;
      preferences: {
        theme: string;
        language: string;
        notifications: boolean;
      };
      tags: string[];
      metadata: {
        createdAt: string;
        updatedAt: string;
      };
    };

    const complexObject: ComplexObject = {
      id: 1,
      name: 'Test User',
      preferences: {
        theme: 'dark',
        language: 'ru',
        notifications: true,
      },
      tags: ['user', 'test', 'cache'],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await cacheService.set('complex-object', complexObject);
    const cachedObject = await cacheService.get<ComplexObject>('complex-object');

    expect(cachedObject).toEqual(complexObject);
    expect(cachedObject?.preferences.theme).toBe('dark');
    expect(cachedObject?.tags).toHaveLength(3);
  });

  it('should handle cache miss gracefully', async () => {
    const nonExistentValue = await cacheService.get('non-existent-key');
    expect(nonExistentValue).toBeNull();
  });

  it('should handle concurrent cache operations', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(cacheService.set(`concurrent-key-${i}`, `value-${i}`));
    }

    await Promise.all(promises);

    for (let i = 0; i < 10; i++) {
      const value = await cacheService.get(`concurrent-key-${i}`);
      expect(value).toBe(`value-${i}`);
    }
  });
});
