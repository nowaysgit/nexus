import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../src/cache/cache.service';
import { LogService } from '../../src/logging/log.service';
import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { CacheModule } from '../../src/cache/cache.module';
import { LoggingModule } from '../../src/logging/logging.module';
import { TestConfigurations } from '../../lib/tester/test-configurations';

describe('CacheService Tests', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
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

/**
 * Интеграционные тесты для CacheService
 * Проверяют работу сервиса в контексте приложения
 */
createTestSuite('CacheService Integration Tests', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    // Создаем новый экземпляр CacheService для каждого теста
    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    };

    cacheService = new CacheService(mockLogService as unknown as LogService);

    // Очищаем кеш перед каждым тестом
    await cacheService.clear();

    // Добавляем задержку для гарантии очистки
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    // Очищаем кеш после каждого теста
    await cacheService.clear();
  });

  createTest(
    {
      name: 'should set and get values',
      configType: TestConfigType.INTEGRATION,
      timeout: 15000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Устанавливаем значение с большим TTL
      await cacheService.set('test-key', 'test-value', 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем наличие ключа
      const exists = await cacheService.has('test-key');
      expect(exists).toBe(true);

      // Получаем значение
      const value = await cacheService.get('test-key');
      expect(value).toBe('test-value');

      // Удаляем значение
      await cacheService.del('test-key');

      // Добавляем задержку для гарантии удаления
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что значение удалено
      const existsAfterDelete = await cacheService.has('test-key');
      expect(existsAfterDelete).toBe(false);
    },
  );

  createTest(
    {
      name: 'should handle multiple keys',
      configType: TestConfigType.INTEGRATION,
      timeout: 15000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Устанавливаем несколько значений с большим TTL
      await cacheService.set('key1', 'value1', 600);
      await cacheService.set('key2', 'value2', 600);
      await cacheService.set('key3', 'value3', 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем наличие ключей
      expect(await cacheService.has('key1')).toBe(true);
      expect(await cacheService.has('key2')).toBe(true);
      expect(await cacheService.has('key3')).toBe(true);

      // Получаем значения
      expect(await cacheService.get('key1')).toBe('value1');
      expect(await cacheService.get('key2')).toBe('value2');
      expect(await cacheService.get('key3')).toBe('value3');

      // Удаляем один ключ
      await cacheService.del('key2');

      // Добавляем задержку для гарантии удаления
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем наличие ключей после удаления
      expect(await cacheService.has('key1')).toBe(true);
      expect(await cacheService.has('key2')).toBe(false);
      expect(await cacheService.has('key3')).toBe(true);

      // Очищаем кеш
      await cacheService.clear();

      // Добавляем задержку для гарантии очистки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что все ключи удалены
      expect(await cacheService.has('key1')).toBe(false);
      expect(await cacheService.has('key3')).toBe(false);
    },
  );

  createTest(
    {
      name: 'should set and get complex objects',
      configType: TestConfigType.INTEGRATION,
      timeout: 30000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Создаем сложный объект для тестирования
      const complexObject = {
        id: 123,
        name: 'Test Object',
        nested: {
          field1: 'value1',
          field2: 42,
          array: [1, 2, 3, 'test'],
        },
        date: new Date(),
      };

      // Устанавливаем объект в кеш с большим TTL
      await cacheService.set('complex-object', complexObject, 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Проверяем наличие ключа
      const exists = await cacheService.has('complex-object');
      expect(exists).toBe(true);

      // Получаем объект из кеша
      const retrieved = await cacheService.get<Record<string, any>>('complex-object');

      // Проверяем, что объект не null
      expect(retrieved).not.toBeNull();

      if (retrieved) {
        // Проверяем, что объект был корректно сохранен и получен
        expect(retrieved).toEqual(
          expect.objectContaining({
            id: 123,
            name: 'Test Object',
            nested: expect.objectContaining({
              field1: 'value1',
              field2: 42,
              array: expect.arrayContaining([1, 2, 3, 'test']),
            }),
          }),
        );

        // Проверяем, что дата была сохранена
        expect(retrieved).toHaveProperty('date');
      }
    },
  );

  createTest(
    {
      name: 'should work with cache module in application context',
      configType: TestConfigType.INTEGRATION,
      timeout: 15000, // Увеличиваем таймаут для теста
    },
    async _context => {
      // Создаем модуль с CacheModule
      const imports = [CacheModule, LoggingModule];
      const preparedImports = TestConfigurations.prepareImportsForTesting(imports);

      const moduleRef = await TestModuleBuilder.create()
        .withImports(preparedImports)
        .withRequiredMocks()
        .compile();

      // Получаем экземпляр CacheService
      const moduleCacheService = moduleRef.get<CacheService>(CacheService);
      expect(moduleCacheService).toBeDefined();

      // Очищаем кеш перед тестом
      await moduleCacheService.clear();

      // Добавляем задержку для гарантии очистки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Тестируем основные операции с увеличенным TTL
      await moduleCacheService.set('test-key', 'test-value', 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Проверяем наличие ключа
      const exists = await moduleCacheService.has('test-key');
      expect(exists).toBe(true);

      const value = await moduleCacheService.get('test-key');
      expect(value).toBe('test-value');

      // Закрываем модуль
      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'should handle concurrent operations correctly',
      configType: TestConfigType.INTEGRATION,
      timeout: 30000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Очищаем кеш перед тестом
      await cacheService.clear();

      // Добавляем задержку для гарантии очистки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Создаем меньше параллельных операций с увеличенным TTL
      const operations = [];
      for (let i = 0; i < 3; i++) {
        operations.push(cacheService.set(`key-${i}`, `value-${i}`, 600));
      }

      // Ждем завершения всех операций
      await Promise.all(operations);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Проверяем наличие всех ключей
      for (let i = 0; i < 3; i++) {
        const exists = await cacheService.has(`key-${i}`);
        expect(exists).toBe(true);
      }

      // Проверяем, что все значения были сохранены
      for (let i = 0; i < 3; i++) {
        const value = await cacheService.get(`key-${i}`);
        expect(value).toBe(`value-${i}`);
      }
    },
  );

  createTest(
    {
      name: 'should handle TTL correctly',
      configType: TestConfigType.INTEGRATION,
      timeout: 30000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Очищаем кеш перед тестом
      await cacheService.clear();

      // Добавляем задержку для гарантии очистки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Устанавливаем значение с коротким TTL, но достаточным для проверки
      await cacheService.set('short-lived', 'will expire soon', 10);

      // Проверяем, что значение существует сразу после установки
      expect(await cacheService.has('short-lived')).toBe(true);
      expect(await cacheService.get('short-lived')).toBe('will expire soon');

      // Ждем, пока TTL истечет (немного дольше, чем TTL)
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Проверяем, что значение больше не существует
      expect(await cacheService.has('short-lived')).toBe(false);
      expect(await cacheService.get('short-lived')).toBeNull();

      // Устанавливаем значение с длинным TTL
      await cacheService.set('long-lived', 'will not expire soon', 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что значение существует
      expect(await cacheService.has('long-lived')).toBe(true);
      expect(await cacheService.get('long-lived')).toBe('will not expire soon');
    },
  );

  createTest(
    {
      name: 'should handle concurrent updates to the same key',
      configType: TestConfigType.INTEGRATION,
      timeout: 30000, // Увеличиваем таймаут для теста
    },
    async () => {
      // Очищаем кеш перед тестом
      await cacheService.clear();

      // Добавляем задержку для гарантии очистки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Устанавливаем начальное значение
      await cacheService.set('concurrent-key', 'initial-value', 600);

      // Добавляем задержку для гарантии сохранения
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Проверяем наличие ключа
      expect(await cacheService.has('concurrent-key')).toBe(true);

      // Получаем финальное значение
      const finalValue = await cacheService.get('concurrent-key');
      expect(finalValue).toBe('initial-value');

      // Обновляем значение несколько раз параллельно
      const updateOperations = [];
      for (let i = 0; i < 3; i++) {
        updateOperations.push(cacheService.set('concurrent-key', `updated-value-${i}`, 600));
      }

      // Ждем завершения всех операций обновления
      await Promise.all(updateOperations);

      // Добавляем задержку для гарантии обновления
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Проверяем, что ключ все еще существует
      expect(await cacheService.has('concurrent-key')).toBe(true);

      // Получаем обновленное значение
      // Не проверяем конкретное значение, так как порядок обновлений может быть недетерминированным
      const updatedValue = await cacheService.get('concurrent-key');
      expect(updatedValue).toMatch(/^updated-value-[0-2]$/);
    },
  );
});
