import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

describe('CacheService - Comprehensive Tests', () => {
  let service: CacheService;
  let mockLogService: MockLogService;

  beforeEach(async () => {
    // Создаем mock LogService с jest spies до инициализации модуля
    const mockLogServiceInstance = new MockLogService();
    jest.spyOn(mockLogServiceInstance, 'setContext');
    jest.spyOn(mockLogServiceInstance, 'log');
    jest.spyOn(mockLogServiceInstance, 'debug');
    jest.spyOn(mockLogServiceInstance, 'error');
    jest.spyOn(mockLogServiceInstance, 'warn');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: LogService,
          useValue: mockLogServiceInstance,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    mockLogService = mockLogServiceInstance;
  });

  afterEach(async () => {
    await service.clear();
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined();
      expect(mockLogService.setContext).toHaveBeenCalledWith('CacheService');
      expect(mockLogService.log).toHaveBeenCalledWith('Упрощенный кэш инициализирован');
    });

    it('should not start cleanup interval in test environment', () => {
      // Проверяем, что в тестовом окружении интервал не запускается
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Создаем новый экземпляр сервиса
      const testModule = Test.createTestingModule({
        providers: [CacheService, { provide: LogService, useClass: MockLogService }],
      }).compile();

      expect(testModule).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('basic cache operations', () => {
    it('should set and get values correctly', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', number: 123 };

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return default value for non-existent keys', async () => {
      const defaultValue = 'default-value';
      const result = await service.get('non-existent-key', defaultValue);
      expect(result).toBe(defaultValue);
    });

    it('should check key existence correctly', async () => {
      const key = 'existence-test';
      const value = 'test-value';

      expect(await service.has(key)).toBe(false);

      await service.set(key, value);
      expect(await service.has(key)).toBe(true);
    });

    it('should delete keys correctly', async () => {
      const key = 'delete-test';
      const value = 'test-value';

      await service.set(key, value);
      expect(await service.has(key)).toBe(true);

      const deleted = await service.del(key);
      expect(deleted).toBe(true);
      expect(await service.has(key)).toBe(false);
    });

    it('should support delete alias method', async () => {
      const key = 'delete-alias-test';
      const value = 'test-value';

      await service.set(key, value);
      expect(await service.has(key)).toBe(true);

      const deleted = await service.delete(key);
      expect(deleted).toBe(true);
      expect(await service.has(key)).toBe(false);
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await service.del('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('TTL and expiration', () => {
    it('should expire items after TTL', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      const ttl = 1; // 1 секунда

      await service.set(key, value, ttl);
      expect(await service.get(key)).toBe(value);

      // Ждем истечения TTL
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(await service.get(key)).toBeNull();
      expect(await service.has(key)).toBe(false);
    });

    it('should use default TTL when not specified', async () => {
      const key = 'default-ttl-test';
      const value = 'default-ttl-value';

      await service.set(key, value);
      expect(await service.get(key)).toBe(value);
      expect(await service.has(key)).toBe(true);
    });

    it('should handle custom TTL values', async () => {
      const key = 'custom-ttl-test';
      const value = 'custom-ttl-value';
      const ttl = 2; // 2 секунды

      await service.set(key, value, ttl);
      expect(await service.get(key)).toBe(value);

      // Проверяем через 1 секунду - должно еще существовать
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(await service.get(key)).toBe(value);

      // Проверяем через еще 1.5 секунды - должно истечь
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(await service.get(key)).toBeNull();
    });
  });

  describe('null and undefined handling', () => {
    it('should not store null values', async () => {
      const key = 'null-test';

      await service.set(key, null);
      expect(await service.has(key)).toBe(false);
      expect(await service.get(key)).toBeNull();
    });

    it('should not store undefined values', async () => {
      const key = 'undefined-test';

      await service.set(key, undefined);
      expect(await service.has(key)).toBe(false);
      expect(await service.get(key)).toBeNull();
    });

    it('should store falsy values that are not null/undefined', async () => {
      const testCases = [
        { key: 'false-test', value: false },
        { key: 'zero-test', value: 0 },
        { key: 'empty-string-test', value: '' },
        { key: 'empty-array-test', value: [] },
        { key: 'empty-object-test', value: {} },
      ];

      for (const testCase of testCases) {
        await service.set(testCase.key, testCase.value);
        expect(await service.get(testCase.key)).toEqual(testCase.value);
        expect(await service.has(testCase.key)).toBe(true);
      }
    });
  });

  describe('cache management operations', () => {
    it('should clear all cache entries', async () => {
      const entries = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ];

      // Устанавливаем несколько записей
      for (const entry of entries) {
        await service.set(entry.key, entry.value);
      }

      // Проверяем, что записи существуют
      for (const entry of entries) {
        expect(await service.has(entry.key)).toBe(true);
      }

      // Очищаем кэш
      await service.clear();

      // Проверяем, что все записи удалены
      for (const entry of entries) {
        expect(await service.has(entry.key)).toBe(false);
      }

      expect(mockLogService.debug).toHaveBeenCalledWith('Кэш очищен');
    });

    it('should get all valid keys', async () => {
      const validEntries = [
        { key: 'valid1', value: 'value1' },
        { key: 'valid2', value: 'value2' },
      ];

      const expiredEntry = { key: 'expired', value: 'expired-value' };

      // Устанавливаем валидные записи
      for (const entry of validEntries) {
        await service.set(entry.key, entry.value);
      }

      // Устанавливаем запись, которая скоро истечет
      await service.set(expiredEntry.key, expiredEntry.value, 1);

      // Получаем ключи
      let keys = await service.keys();
      expect(keys).toHaveLength(3);
      expect(keys.sort()).toEqual(['expired', 'valid1', 'valid2']);

      // Ждем истечения
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Получаем ключи снова - истекшие должны быть удалены
      keys = await service.keys();
      expect(keys).toHaveLength(2);
      expect(keys.sort()).toEqual(['valid1', 'valid2']);
    });

    it('should return empty array for keys when cache is empty', async () => {
      const keys = await service.keys();
      expect(keys).toEqual([]);
    });
  });

  describe('statistics and monitoring', () => {
    it('should track hit and miss statistics', async () => {
      const key = 'stats-test';
      const value = 'stats-value';

      // Начальная статистика
      let stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Miss - запрос несуществующего ключа
      await service.get('non-existent');
      stats = await service.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.hitRate).toBe(0);

      // Set и Hit
      await service.set(key, value);
      await service.get(key);
      stats = await service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.hitRate).toBe(0.5);

      // Еще один hit
      await service.get(key);
      stats = await service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should include size in statistics', async () => {
      let stats = await service.getStats();
      expect(stats.size).toBe(0);

      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      stats = await service.getStats();
      expect(stats.size).toBe(2);
    });

    it('should provide cache information', () => {
      const info = service.getInfo();

      expect(info).toHaveProperty('type', 'SimpleMemoryCache');
      expect(info).toHaveProperty('version', '1.1.0');
      expect(info).toHaveProperty('description');
      expect(info).toHaveProperty('stats');
      expect(info).toHaveProperty('settings');

      const settings = info.settings as Record<string, unknown>;
      expect(settings).toHaveProperty('defaultTtl');
      expect(settings).toHaveProperty('maxItems');
      expect(settings).toHaveProperty('keyPrefix');
      expect(settings).toHaveProperty('isStopped');
    });

    it('should clean expired items before calculating stats', async () => {
      // Добавляем запись, которая скоро истечет
      await service.set('temp-key', 'temp-value', 1);

      let stats = await service.getStats();
      expect(stats.size).toBe(1);

      // Ждем истечения
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Статистика должна очистить истекшие элементы
      stats = await service.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('service lifecycle', () => {
    it('should stop service correctly', async () => {
      const key = 'lifecycle-test';
      const value = 'lifecycle-value';

      await service.set(key, value);
      expect(await service.has(key)).toBe(true);

      await service.stop();

      // После остановки все операции должны возвращать безопасные значения
      expect(await service.get('any-key')).toBeNull();
      expect(await service.get('any-key', 'default')).toBe('default');
      expect(await service.has('any-key')).toBe(false);
      expect(await service.del('any-key')).toBe(false);
      expect(await service.keys()).toEqual([]);

      const stats = await service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      expect(mockLogService.log).toHaveBeenCalledWith('Кэш остановлен и очищен');
    });

    it('should handle module destruction', () => {
      service.onModuleDestroy();
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Упрощенный кэш очищен при уничтожении модуля',
      );
    });

    it('should not allow operations after stop', async () => {
      await service.stop();

      await service.set('test', 'value');
      // Set не должен ничего делать после остановки

      expect(await service.get('test')).toBeNull();
      expect(await service.has('test')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle complex objects', async () => {
      const complexObject = {
        string: 'test',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3, { nested: true }],
        object: {
          nested: {
            deep: 'value',
            array: ['a', 'b', 'c'],
          },
        },
        date: new Date(),
        regex: /test/gi,
      };

      await service.set('complex', complexObject);
      const retrieved = await service.get('complex');

      expect(retrieved).toEqual(complexObject);
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      const value = 'long-key-value';

      await service.set(longKey, value);
      expect(await service.get(longKey)).toBe(value);
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = [
        'key:with:colons',
        'key with spaces',
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key@with@symbols',
        'key#with#hash',
        'ключ-с-русскими-символами',
        '🔑-emoji-key',
      ];

      for (const key of specialKeys) {
        const value = `value-for-${key}`;
        await service.set(key, value);
        expect(await service.get(key)).toBe(value);
      }
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      // Запускаем множество параллельных операций
      for (let i = 0; i < 100; i++) {
        promises.push(service.set(`key-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      // Проверяем, что все записи были сохранены
      for (let i = 0; i < 100; i++) {
        expect(await service.get(`key-${i}`)).toBe(`value-${i}`);
      }
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(100000); // 100KB строка
      const key = 'large-value-test';

      await service.set(key, largeValue);
      expect(await service.get(key)).toBe(largeValue);
    });
  });

  describe('memory management', () => {
    it('should handle memory cleanup with many entries', async () => {
      // Добавляем много записей
      const numberOfEntries = 50;
      for (let i = 0; i < numberOfEntries; i++) {
        await service.set(`bulk-key-${i}`, `bulk-value-${i}`);
      }

      let stats = await service.getStats();
      expect(stats.size).toBe(numberOfEntries);

      // Очищаем кэш
      await service.clear();

      stats = await service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should track statistics correctly with clear operation', async () => {
      // Добавляем записи и делаем операции для накопления статистики
      await service.set('stat-key-1', 'value1');
      await service.set('stat-key-2', 'value2');
      await service.get('stat-key-1'); // hit
      await service.get('non-existent'); // miss

      let stats = await service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Очищаем - статистика должна сброситься
      await service.clear();

      stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });
});
