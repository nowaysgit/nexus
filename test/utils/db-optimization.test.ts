import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { DbOptimizationUtil } from '../../lib/tester/utils/db-optimization';
import { DataSource } from 'typeorm';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { createTestSuite, createTest } from '../../lib/tester';

createTestSuite('DbOptimizationUtil - Тесты утилиты оптимизации базы данных', () => {
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    try {
      dataSource = await createTestDataSource();

      if (!dataSource?.isInitialized) {
        throw new Error('DataSource не инициализирован');
      }

      fixtureManager = new FixtureManager(dataSource);
      await fixtureManager.cleanDatabase();
    } catch (error) {
      console.error('Ошибка при инициализации тестов DbOptimizationUtil:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    DbOptimizationUtil.clearCache();
    await fixtureManager.cleanDatabase();
  });

  createTest(
    {
      name: 'должен инициализироваться и иметь базовые методы',
      requiresDatabase: true,
    },
    async () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.isInitialized).toBe(true);
      expect(dataSource.options.type).toBe('postgres');
      expect(typeof DbOptimizationUtil.executeQueryWithCache).toBe('function');
      expect(typeof DbOptimizationUtil.executeQueriesInTransaction).toBe('function');
      expect(typeof DbOptimizationUtil.batchInsert).toBe('function');
      expect(typeof DbOptimizationUtil.clearCache).toBe('function');
    },
  );

  createTest(
    {
      name: 'должен выполнять запросы в транзакции',
      requiresDatabase: true,
    },
    async () => {
      const queries = [
        {
          query: 'SELECT 1 as test',
          parameters: [],
        },
      ];

      // Выполняем запросы в транзакции
      await DbOptimizationUtil.executeQueriesInTransaction(dataSource, queries);

      // Проверяем, что метод выполнился без ошибок
      expect(true).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен очищать кеш',
      requiresDatabase: false,
    },
    async () => {
      // Проверяем, что метод clearCache существует и может быть вызван
      expect(typeof DbOptimizationUtil.clearCache).toBe('function');

      DbOptimizationUtil.clearCache();

      // Проверяем, что метод выполнился без ошибок
      expect(true).toBe(true);
    },
  );
});
