import { DynamicModule, ForwardReference, INestApplication, Provider, Type } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'winston';
import { DataSource } from 'typeorm';
import { TestConfigurations, TestConfig } from './test-configurations';
import { ALL_TEST_ENTITIES } from './entities';
import { requiredMocksAdder } from './test-configurations';
import { FixtureManager } from './fixtures/fixture-manager';

// Переопределяем jest.setTimeout
jest.setTimeout(30000); // 30 секунд

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

  private constructor() {}

  public static getInstance(): Tester {
    if (!Tester.instance) {
      Tester.instance = new Tester();
    }
    return Tester.instance;
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

    this.builder = Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            ...(config?.db || BASE_TEST_CONFIG.database),
            entities: ALL_TEST_ENTITIES,
          }),
        }),
        WinstonModule.forRoot({
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                winston.format.colorize(),
                format.printf(({ level, message, timestamp, ms, context, ...meta }) => {
                  const contextStr = context ? `[${context}] ` : '';
                  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                  return `${timestamp} ${ms} ${level}: ${contextStr}${message}${metaStr}`;
                }),
              ),
            }),
          ],
        }),
        ...(metadata.imports || []),
      ],
      controllers: [...(metadata.controllers || [])],
      providers: requiredMocksAdder((metadata.imports || []) as (Type<any> | DynamicModule)[], [
        ...(metadata.providers || []),
      ]),
    });

    this.module = await this.builder.compile();
    this.app = this.module.createNestApplication();
    await this.app.init();

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

// Импортируем функции для создания тестов из отдельного файла
import { createTestSuite, createTest, createBasicTest } from './utils/test-functions';

export { createTestSuite, createTest, createBasicTest };

// Импортируем функцию для создания тестового подключения к БД
import { createTestDataSource, createTestDataSourceSync } from './utils/data-source';
import { checkDatabaseConnection, waitForDatabaseConnection } from './utils/db-connection-checker';

export {
  FixtureManager,
  Test,
  TestingModuleBuilder,
  TestConfig,
  TestConfigurations,
  ALL_TEST_ENTITIES,
  requiredMocksAdder,
  createTestDataSource,
  createTestDataSourceSync,
  checkDatabaseConnection,
  waitForDatabaseConnection,
};
