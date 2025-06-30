import { createTestDataSource } from '../../lib/tester/utils/data-source';
import { DbCompatibilityUtil } from '../../lib/tester/utils/db-compatibility';
import { DataSource } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { createTestSuite, createTest } from '../../lib/tester';

createTestSuite('DbCompatibilityUtil - Тесты утилиты совместимости баз данных', () => {
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    try {
      dataSource = await createTestDataSource();

      if (!dataSource?.isInitialized) {
        throw new Error('PostgreSQL DataSource не инициализирован');
      }

      fixtureManager = new FixtureManager(dataSource);
      await fixtureManager.cleanDatabase();
    } catch (error) {
      console.error('Ошибка при инициализации тестов DbCompatibilityUtil:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
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
      name: 'должен иметь методы утилиты совместимости',
      requiresDatabase: false,
    },
    async () => {
      expect(typeof DbCompatibilityUtil.adaptQuery).toBe('function');
      expect(typeof DbCompatibilityUtil.isPostgres).toBe('function');
      expect(typeof DbCompatibilityUtil.isSqlite).toBe('function');
      expect(typeof DbCompatibilityUtil.getCurrentTimestampSql).toBe('function');
    },
  );

  createTest(
    {
      name: 'должен работать с PostgreSQL запросами',
      requiresDatabase: true,
    },
    async () => {
      // Создаем тестового пользователя
      const user = await fixtureManager.createUser();

      // Проверяем что пользователь создался через repository
      const userRepo = dataSource.getRepository(User);
      const users = await userRepo.find();

      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].id).toBe(user.id);
    },
  );

  createTest(
    {
      name: 'должен адаптировать запросы через утилиту',
      requiresDatabase: false,
    },
    async () => {
      const testQuery = 'SELECT * FROM "user" LIMIT 10';
      const adaptedQuery = DbCompatibilityUtil.adaptQuery(dataSource, testQuery);

      expect(adaptedQuery).toBeDefined();
      expect(typeof adaptedQuery).toBe('string');
      expect(adaptedQuery.length).toBeGreaterThan(0);
    },
  );
});
