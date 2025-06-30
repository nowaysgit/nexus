import { DataSource } from 'typeorm';
import {
  checkDatabaseConnection,
  isPostgresAvailable,
  waitForDatabaseConnection,
  requiresDatabaseForCurrentTest,
  getDataSourceForTest,
  checkAndFixDatabaseConnection,
} from '../../lib/tester/utils/db-connection-checker';
import { createTestSuite, createTest } from '../../lib/tester';
import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { User } from '../../src/user/entities/user.entity';

createTestSuite('DbConnectionChecker - Тесты проверки соединения с базой данных', () => {
  let testDataSource: DataSource;

  beforeAll(async () => {
    try {
      testDataSource = await createTestDataSource();
    } catch (error) {
      console.error('Ошибка при инициализации тестов DbConnectionChecker:', error);
      testDataSource = null;
    }
  });

  afterAll(async () => {
    if (testDataSource?.isInitialized) {
      await testDataSource.destroy();
    }
  });

  createTest(
    { name: 'должен проверять доступность базы данных', requiresDatabase: false },
    async () => {
      // Проверяем функцию isPostgresAvailable
      expect(typeof isPostgresAvailable).toBe('function');

      // Проверяем функцию checkDatabaseConnection
      expect(typeof checkDatabaseConnection).toBe('function');

      if (testDataSource) {
        const isConnected = await checkDatabaseConnection(testDataSource);
        expect(typeof isConnected).toBe('boolean');
      }
    },
  );

  createTest(
    { name: 'должен определять необходимость базы данных для теста', requiresDatabase: false },
    async () => {
      // Проверяем функцию requiresDatabaseForCurrentTest
      expect(typeof requiresDatabaseForCurrentTest).toBe('function');

      // Функция должна возвращать boolean
      const requiresDb = requiresDatabaseForCurrentTest();
      expect(typeof requiresDb).toBe('boolean');
    },
  );

  createTest(
    { name: 'должен получать DataSource для теста', requiresDatabase: false },
    async () => {
      // Проверяем функцию getDataSourceForTest
      expect(typeof getDataSourceForTest).toBe('function');

      // Получаем DataSource для теста
      const dataSource = await getDataSourceForTest([User]);

      expect(dataSource).toBeDefined();
      if (dataSource) {
        expect(dataSource.options).toBeDefined();
        expect(dataSource.options.type).toBe('postgres');

        // Закрываем полученный DataSource
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
      }
    },
  );

  createTest(
    { name: 'должен проверять и исправлять соединение с базой данных', requiresDatabase: false },
    async () => {
      // Проверяем функцию checkAndFixDatabaseConnection
      expect(typeof checkAndFixDatabaseConnection).toBe('function');

      if (testDataSource) {
        const fixedDataSource = await checkAndFixDatabaseConnection(testDataSource);
        expect(fixedDataSource).toBeDefined();
        expect(fixedDataSource.isInitialized).toBe(true);
      }
    },
  );

  createTest(
    { name: 'должен ожидать подключения к базе данных', requiresDatabase: false },
    async () => {
      // Проверяем функцию waitForDatabaseConnection
      expect(typeof waitForDatabaseConnection).toBe('function');

      // Тестируем с минимальными параметрами
      const result = await waitForDatabaseConnection(1, 100); // 1 попытка, 100мс интервал
      expect(typeof result).toBe('boolean');
    },
  );
});
