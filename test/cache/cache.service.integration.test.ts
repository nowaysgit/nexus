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
  createTest(
    {
      name: 'should set and get complex objects',
      configType: TestConfigType.INTEGRATION,
    },
    async context => {
      // Получаем экземпляр CacheService
      const cacheService = context.get<CacheService>(CacheService);
      expect(cacheService).toBeDefined();

      // Создаем сложный объект для кеширования
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

      // Кешируем объект
      await cacheService.set('complex-object', complexObject, 60);

      // Получаем объект из кеша
      const retrieved = await cacheService.get('complex-object');

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

      // Проверяем, что дата была сохранена как строка (сериализация JSON)
      expect(typeof (retrieved as { date: string }).date).toBe('string');
    },
  );

  createTest(
    {
      name: 'should work with cache module in application context',
      configType: TestConfigType.INTEGRATION,
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
      const cacheService = moduleRef.get<CacheService>(CacheService);
      expect(cacheService).toBeDefined();

      // Тестируем основные операции
      await cacheService.set('test-key', 'test-value', 60);
      const value = await cacheService.get('test-key');
      expect(value).toBe('test-value');

      // Проверяем наличие ключа
      expect(await cacheService.has('test-key')).toBe(true);
      expect(await cacheService.has('non-existent')).toBe(false);

      // Удаляем ключ
      await cacheService.del('test-key');
      expect(await cacheService.has('test-key')).toBe(false);

      // Закрываем модуль
      await moduleRef.close();
    },
  );

  createTest(
    {
      name: 'should handle concurrent operations correctly',
      configType: TestConfigType.INTEGRATION,
    },
    async context => {
      const cacheService = context.get<CacheService>(CacheService);

      // Очищаем кеш перед тестом
      await cacheService.clear();

      // Создаем множество параллельных операций
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(cacheService.set(`key-${i}`, `value-${i}`, 60));
      }

      // Ждем завершения всех операций
      await Promise.all(operations);

      // Проверяем, что все значения были сохранены
      const checkOperations = [];
      for (let i = 0; i < 10; i++) {
        checkOperations.push(
          cacheService.get(`key-${i}`).then(value => {
            expect(value).toBe(`value-${i}`);
          }),
        );
      }

      await Promise.all(checkOperations);

      // Проверяем, что все ключи присутствуют
      const hasOperations = [];
      for (let i = 0; i < 10; i++) {
        hasOperations.push(
          cacheService.has(`key-${i}`).then(exists => {
            expect(exists).toBe(true);
          }),
        );
      }

      await Promise.all(hasOperations);

      // Удаляем все ключи
      const deleteOperations = [];
      for (let i = 0; i < 10; i++) {
        deleteOperations.push(cacheService.del(`key-${i}`));
      }

      await Promise.all(deleteOperations);

      // Проверяем, что все ключи были удалены
      for (let i = 0; i < 10; i++) {
        expect(await cacheService.has(`key-${i}`)).toBe(false);
      }
    },
  );

  createTest(
    {
      name: 'should handle TTL correctly',
      configType: TestConfigType.INTEGRATION,
    },
    async context => {
      const cacheService = context.get<CacheService>(CacheService);

      // Устанавливаем значение с коротким TTL
      await cacheService.set('short-lived', 'will expire soon', 0.01); // 10ms TTL

      // Проверяем, что значение существует сразу после установки
      expect(await cacheService.has('short-lived')).toBe(true);
      expect(await cacheService.get('short-lived')).toBe('will expire soon');

      // Ждем, пока TTL истечет
      await new Promise(resolve => setTimeout(resolve, 20));

      // Проверяем, что значение больше не существует
      expect(await cacheService.has('short-lived')).toBe(false);
      expect(await cacheService.get('short-lived')).toBeNull();

      // Устанавливаем значение с более длительным TTL
      await cacheService.set('long-lived', 'will not expire yet', 60);

      // Проверяем, что значение существует
      expect(await cacheService.has('long-lived')).toBe(true);
      expect(await cacheService.get('long-lived')).toBe('will not expire yet');
    },
  );
});
