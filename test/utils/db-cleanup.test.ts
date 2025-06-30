import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { DbCleanupUtil } from '../../lib/tester/utils/db-cleanup';
import { createTestSuite, createTest } from '../../lib/tester';

createTestSuite('DbCleanupUtil - Тесты утилиты очистки базы данных', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    try {
      dataSource = await createTestDataSource();
    } catch (error) {
      console.error('Ошибка при инициализации тестов DbCleanupUtil:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  createTest(
    {
      name: 'должен инициализироваться с PostgreSQL DataSource',
      requiresDatabase: true,
    },
    async () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.isInitialized).toBe(true);
      expect(dataSource.options.type).toBe('postgres');
    },
  );

  createTest(
    {
      name: 'должен иметь статический метод fastCleanup',
      requiresDatabase: true,
    },
    async () => {
      expect(typeof DbCleanupUtil.fastCleanup).toBe('function');

      // Проверяем, что метод может быть вызван без ошибок
      await DbCleanupUtil.fastCleanup(dataSource);
      expect(true).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен иметь статический метод cleanupTables',
      requiresDatabase: true,
    },
    async () => {
      expect(typeof DbCleanupUtil.cleanupTables).toBe('function');

      // Проверяем, что метод может быть вызван без ошибок с пустым массивом таблиц
      await DbCleanupUtil.cleanupTables(dataSource, []);
      expect(true).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен иметь статический метод setDebug',
      requiresDatabase: false,
    },
    async () => {
      expect(typeof DbCleanupUtil.setDebug).toBe('function');

      // Проверяем, что метод может быть вызван без ошибок
      DbCleanupUtil.setDebug(true);
      DbCleanupUtil.setDebug(false);
      expect(true).toBe(true);
    },
  );
});
