import { DynamicModule, ForwardReference, INestApplication, Provider, Type } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TestConfigurations, TestConfig, requiredMocksAdder } from './test-configurations';
import { FixtureManager } from './fixtures/fixture-manager';
import { TestModuleBuilder } from './utils/test-module-builder';
import { createTestSuite, createTest, createBasicTest } from './utils/test-functions';
import { createTestDataSource, createTestDataSourceSync } from './utils/data-source';
import { checkDatabaseConnection, waitForDatabaseConnection } from './utils/db-connection-checker';
import { ConfigService } from '@nestjs/config';

// Переопределяем jest.setTimeout
jest.setTimeout(30000); // 30 секунд

// Глобальная переменная для хранения информации о текущем тесте
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __currentTest?: {
        params: {
          requiresDatabase?: boolean;
          [key: string]: any;
        };
      };
    }
  }
}

// Для TypeScript 4.x
declare const global: {
  __currentTest?: {
    params: {
      requiresDatabase?: boolean;
      [key: string]: any;
    };
  };
  [key: string]: any;
};

/**
 * Типы тестовых конфигураций
 */
export enum TestConfigType {
  /** Только кеш и логирование, без БД */
  BASIC = 'basic',
  /** С базой данных */
  DATABASE = 'database',
  /** С JWT модулем */
  AUTH = 'auth',
  /** Полная конфигурация со всеми модулями */
  FULL = 'full',
  /** Интеграционные тесты с полной конфигурацией */
  INTEGRATION = 'integration',
}

/**
 * Интерфейс для фикстур теста
 */
export interface ITestFixtures {
  /** Функция для создания фикстур */
  setup?: () => Promise<void>;
  /** Функция для очистки после теста */
  cleanup?: () => Promise<void>;
}

/**
 * Параметры теста
 */
export interface ITestParams {
  /** Название теста */
  name: string;
  /** Описание теста */
  description?: string;
  /** Тип конфигурации теста */
  configType?: TestConfigType;
  /** Дополнительные модули для импорта */
  imports?: any[];
  /** Провайдеры для теста */
  providers?: any[];
  /** Фикстуры для теста */
  fixtures?: ITestFixtures;
  /** Таймаут теста в мс */
  timeout?: number;
  /** Пропустить тест */
  skip?: boolean;
  /** Запустить только этот тест */
  only?: boolean;
  /** Требуется ли подключение к БД */
  requiresDatabase?: boolean;
  /** Дополнительные сущности для TypeORM (если не нужны все) */
  entities?: any[];
}

/**
 * Контекст теста
 */
export interface ITestContext {
  /** Модуль тестирования */
  module: TestingModule;
  /** Приложение NestJS */
  app: INestApplication;
  /** Подключение к БД (опционально) */
  dataSource?: DataSource;
  /** Получить сервис (не типизированная версия для совместимости со старыми тестами) */
  get(token: Type<unknown> | string | symbol): unknown;
  /** Получить сервис (типизированная версия) */
  get<T>(token: Type<T> | string | symbol): T;
  /** Очистить БД */
  clearDatabase(): Promise<void>;
}

/**
 * Функция теста
 */
export type TestFunction = (context: ITestContext) => Promise<void>;

/**
 * Базовая конфигурация для всех типов тестов
 */
export const BASE_TEST_CONFIG = {
  database: {
    type: 'postgres' as const,
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'nexus_test',
    synchronize: true,
    dropSchema: true,
    logging: false,
    entities: ['src/**/*.entity{.ts,.js}'],
    retryAttempts: 3,
    retryDelay: 2000,
    extra: {
      max: 1, // Минимизируем количество соединений для тестов
      min: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      acquireTimeoutMillis: 5000,
    },
  },
};

export class Tester {
  private static instance: Tester;
  public app: INestApplication;
  public module: TestingModule;
  private builder: TestingModuleBuilder;
  private dataSource: DataSource;
  private currentTestParams: any;

  private constructor() {}

  public static getInstance(): Tester {
    if (!Tester.instance) {
      Tester.instance = new Tester();
    }
    return Tester.instance;
  }

  // Метод для установки параметров текущего теста
  public setCurrentTestParams(params: any): void {
    this.currentTestParams = params;
    // Устанавливаем глобальную переменную для доступа из других модулей
    global.__currentTest = { params };
  }

  public async init(
    configType: TestConfigType,
    metadata: {
      imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference>;
      providers?: Provider[];
      controllers?: Type<any>[];
    } = {},
  ): Promise<TestingModule> {
    const config = TestConfigurations[configType];

    // Подготавливаем импорты (заменяем LoggingModule, TelegrafModule, добавляем MockTypeOrmModule)
    const preparedImports = TestConfigurations.prepareImportsForTesting(
      (metadata.imports || []) as (Type<any> | DynamicModule)[],
    ) as unknown as (Type<any> | DynamicModule)[];

    const importsForMocks: (Type<any> | DynamicModule)[] = preparedImports.filter(
      (imp): imp is Type<any> | DynamicModule => typeof (imp as any)?.then !== 'function',
    );

    this.builder = Test.createTestingModule({
      imports: [...preparedImports],
      controllers: [...(metadata.controllers || [])],
      providers: requiredMocksAdder(importsForMocks, [...(metadata.providers || [])]),
    });

    this.module = await this.builder.compile();
    this.app = this.module.createNestApplication();
    await this.app.init();

    // DEBUG: проверяем наличие EncryptionService и ApiKeyService в контейнере
    try {
      const { EncryptionService } = await import('../../src/infrastructure/encryption.service');
      const { ApiKeyService } = await import('../../src/infrastructure/api-key.service');
      const enc = this.module.get(EncryptionService, { strict: false });
      const api = this.module.get(ApiKeyService, { strict: false });

      console.log('[Tester DEBUG] EncryptionService from container:', enc ? 'FOUND' : 'NOT FOUND');
      console.log('[Tester DEBUG] ApiKeyService from container:', api ? 'FOUND' : 'NOT FOUND');
    } catch {
      // ignore
    }

    return this.module;
  }

  public async setupTestEnvironment(
    configType: TestConfigType,
    metadata: {
      imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference>;
      providers?: Provider[];
      controllers?: Type<any>[];
    } = {},
  ): Promise<DataSource> {
    await this.init(configType, metadata);

    // Если текущий тест не требует базы данных, возвращаем null
    if (this.currentTestParams?.requiresDatabase === false) {
      console.log('[Tester] Пропускаем подключение к базе данных, т.к. requiresDatabase: false');
      return null;
    }

    this.dataSource = this.module.get<DataSource>(DataSource);
    return this.dataSource;
  }

  public async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }

    // Очищаем информацию о текущем тесте
    this.currentTestParams = null;
    global.__currentTest = undefined;
  }

  public get<T>(token: Type<T> | string): T {
    return this.module.get<T>(token);
  }

  public getDataSource(): DataSource {
    return this.dataSource;
  }

  public async forceCleanup() {
    await this.close();

    // Закрываем все соединения через DbConnectionManager
    const { DbConnectionManager } = await import('./utils/db-connection-manager');
    await DbConnectionManager.closeAllConnections();

    Tester.instance = null;
  }
}

// Экспортируем все необходимые классы и функции
export {
  createTestSuite,
  createTest,
  createBasicTest,
  FixtureManager,
  Test,
  TestingModuleBuilder,
  TestConfig,
  TestConfigurations,
  createTestDataSource,
  createTestDataSourceSync,
  checkDatabaseConnection,
  waitForDatabaseConnection,
  TestModuleBuilder,
};
