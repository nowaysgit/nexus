import { TestConfigType, ITestParams, TestFunction, Tester, ITestContext } from '.';
import { DataSource } from 'typeorm';

/**
 * Создает набор тестов
 */
export function createTestSuite(name: string, testsCallback: () => void): void {
  describe(name, () => {
    testsCallback();
  });
}

/**
 * Создает тест с заданными параметрами
 */
export function createTest(params: ITestParams, testFunction: TestFunction): void {
  const {
    name,
    description,
    configType = TestConfigType.BASIC,
    skip,
    only,
    timeout,
    imports = [],
    providers = [],
  } = params;

  // Сохраняем параметры текущего теста в глобальной переменной для доступа из MockTypeOrmModule

  (global as any).__currentTest = {
    params,
    name,
    description,
    configType,
  };

  const testFn = async () => {
    const tester = Tester.getInstance();
    let dataSource: DataSource;

    try {
      // Устанавливаем параметры текущего теста для использования в MockTypeOrmModule
      tester.setCurrentTestParams(params);

      // Настраиваем тестовое окружение
      dataSource = await tester.setupTestEnvironment(configType, { imports, providers });

      // Создаем контекст для передачи в тестовую функцию
      const context: ITestContext = {
        module: tester.module,
        app: tester.app,
        dataSource,
        get: <T>(token: any) => tester.get<T>(token),
        clearDatabase: async () => {
          if (dataSource && dataSource.isInitialized) {
            const entities = dataSource.entityMetadatas;
            const tableNames = entities.map(entity => `"${entity.tableName}"`).join(', ');
            await dataSource.query(`TRUNCATE ${tableNames} CASCADE;`);
          }
        },
      };

      // Вызываем тестовую функцию с контекстом
      await testFunction(context);
    } finally {
      // Очищаем информацию о текущем тесте после завершения

      (global as any).__currentTest = null;
      await tester.forceCleanup();
    }
  };

  // Создаем тест в зависимости от параметров
  const testTitle = description ? `${name} - ${description}` : name;
  if (skip) {
    it.skip(testTitle, testFn);
  } else if (only) {
    it.only(testTitle, testFn);
  } else if (timeout) {
    it(testTitle, testFn, timeout);
  } else {
    it(testTitle, testFn);
  }
}

/**
 * Создает базовый тест без дополнительных параметров
 */
export function createBasicTest(name: string, testFunction: TestFunction): void {
  createTest({ name, configType: TestConfigType.BASIC }, testFunction);
}
