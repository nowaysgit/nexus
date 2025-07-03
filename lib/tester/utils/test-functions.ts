import { TestingModule } from '@nestjs/testing';
import { DynamicModule, ForwardReference, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { TestConfigType, Tester } from '../index';
import { FixtureManager } from '../fixtures/fixture-manager';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

/**
 * Создает тестовый набор (test suite) с указанным именем
 * @param name Название тестового набора
 * @param suite Функция, содержащая тесты
 */
export function createTestSuite(name: string, suite: () => void): void {
  describe(name, () => {
    suite();
  });
}

/**
 * Параметры для создания теста
 */
export interface ICreateTestParams {
  /** Название теста */
  name: string;
  /** Тип конфигурации теста */
  configType?: TestConfigType;
  /** Дополнительные модули для импорта */
  imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference>;
  /** Провайдеры для теста */
  providers?: Provider[];
  /** Таймаут теста в мс */
  timeout?: number;
  /** Требуется ли база данных для теста */
  requiresDatabase?: boolean;
  /** Конфигурация теста (для обратной совместимости) */
  config?: { type: TestConfigType };
}

/**
 * Очищает базу данных для теста
 * @param module Тестовый модуль
 */
async function cleanupDatabase(module: TestingModule): Promise<void> {
  try {
    // Получаем DataSource из модуля
    const dataSource = module.get(DataSource);
    if (!dataSource || !dataSource.isInitialized) {
      console.warn('DataSource не инициализирован, пропускаем очистку базы данных');
      return;
    }

    // Создаем экземпляр FixtureManager для очистки базы
    const fixtureManager = new FixtureManager(dataSource);

    // Очищаем базу данных
    await fixtureManager.cleanDatabase();
    console.log('База данных очищена перед тестом');
  } catch (error) {
    console.error('Ошибка при очистке базы данных:', error);
  }
}

/**
 * Создает отдельный тест с указанным именем и типом конфигурации
 * @param params Параметры теста (имя, тип конфигурации, импорты, провайдеры)
 * @param testFn Функция теста
 */
export function createTest(
  {
    name,
    configType = TestConfigType.DATABASE,
    imports = [],
    providers = [],
    timeout,
    requiresDatabase = true,
    config,
  }: ICreateTestParams,
  testFn: (context: TestingModule) => Promise<void>,
): void {
  const testFunction = async () => {
    // Устанавливаем параметры текущего теста в глобальную переменную
    const testParams = {
      name,
      configType,
      imports,
      providers,
      requiresDatabase,
    };

    (global as any).__currentTest = {
      params: testParams,
      name,
      configType,
    };

    try {
      // Используем динамический импорт для избежания циклических зависимостей
      // но с типизацией для безопасности
      const tester = Tester.getInstance();

      // Устанавливаем параметры теста в tester
      tester.setCurrentTestParams(testParams);

      // Если указан config.type, используем его для обратной совместимости
      const actualConfigType = config?.type || configType;

      // Если тест не требует базы данных, используем BASIC конфигурацию
      const finalConfigType = requiresDatabase ? actualConfigType : TestConfigType.BASIC;

      const module = await tester.init(finalConfigType, { imports, providers });

      // Оборачиваем get чтобы сохранить корректный this при деструктуризации
      const boundGet = <T>(token: any, options?: any): T => module.get<T>(token, options);
      const context = Object.assign(Object.create(module), {
        get: boundGet,
      }) as TestingModule & { get: typeof boundGet };

      // Если тест требует базу данных, выполняем очистку непосредственно перед запуском теста
      if (requiresDatabase) {
        await cleanupDatabase(module);
      }

      await testFn(context);
    } finally {
      // Очищаем глобальную переменную после завершения теста
      (global as any).__currentTest = null;
    }
  };

  if (timeout) {
    test(name, testFunction, timeout);
  } else {
    test(name, testFunction);
  }
}

/**
 * Интерфейс контекста базового теста
 */
export interface IBasicTestContext {
  tester: Tester;
  fixtureManager: FixtureManager;
  configService: ConfigService;
  logService: Logger;
  dataSource?: DataSource;
}

/**
 * Создает базовый тест с минимальной конфигурацией
 * @param params Параметры теста
 */
export function createBasicTest({
  name,
  test,
}: {
  name: string;
  test: (context: IBasicTestContext) => void;
}): void {
  it(name, async () => {
    const tester = Tester.getInstance();
    const module = await tester.init(TestConfigType.BASIC);
    const dataSource = tester.getDataSource();
    // Используем явное приведение типов для обхода ошибок линтера
    // Эти объекты гарантированно будут иметь нужные типы в реальном окружении
    const fixtureManager = new FixtureManager(dataSource);
    const configService = module.get<ConfigService>(ConfigService);
    const logService = module.get<Logger>(WINSTON_MODULE_PROVIDER);

    test({ tester, fixtureManager, configService, logService, dataSource });
  });
}
