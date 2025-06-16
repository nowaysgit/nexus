/* eslint-disable */

/**
 * Центральный экспорт тестовых конфигураций и утилит
 */

import { Provider, Type, DynamicModule } from '@nestjs/common';
import {
  getDialogTestConfig,
  addMockUserServiceToProviders,
  containsDialogModule,
} from './dialog-test.config';
import { mockUserService } from '../mocks/user-service.mock';
import {
  containsTelegramModule,
  addMockTelegramServiceToProviders,
  addTelegrafTokenToProviders,
  replaceTelegrafModule,
  containsTelegrafModule,
} from './telegram-test.configuration';
import { addLoggingMocks } from './logging-test.configuration';
import { addLLMMocks, containsLLMModule } from './llm-test.configuration';
import { ConfigServiceProvider } from '../mocks/config.service.mock';
import { mockConfigService } from '../mocks/config.service.mock';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MockEventEmitter } from '../mocks/event-emitter.mock';
import { CacheService } from '../../../src/cache/cache.service';
import { DataSource } from 'typeorm';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MockLoggingModule } from '../mocks/mock-logging.module';
import { LoggingModule } from '../../../src/logging/logging.module';
import { MockTypeOrmModule } from '../mocks/mock-typeorm.module';
import { MockProviderFactory } from '../mocks/mock-provider';
import { MockApiKeyService, MockEncryptionService } from '../mocks';
import { ApiKeyService } from '../../../src/infrastructure/api-key.service';
import { EncryptionService } from '../../../src/infrastructure/encryption.service';
import { MockDialogRepositoryModule } from '../mocks/mock-dialog-repository.module';

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-unsafe-return */

// Определяем интерфейс для конфигурации
export interface TestConfig {
  providers: Provider[];
  [key: string]: any;
}

// Экспортируем функции из других модулей
export * from './logging-test.configuration';
export * from './llm-test.configuration';
export * from './telegram-test.configuration';
export * from './dialog-test.config';

/**
 * Автоматически добавляет все необходимые моки на основе импортируемых модулей
 * @param imports массив импортов модулей
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленными моками
 */
export function requiredMocksAdder(
  imports: (Type<any> | DynamicModule)[] = [],
  providers: Provider[] = [],
): Provider[] {
  let updatedProviders = [...providers];

  // Если в импортах есть DialogModule, добавляем мок UserService
  if (containsDialogModule(imports)) {
    updatedProviders = addMockUserServiceToProviders(updatedProviders);
  }

  // Если в импортах есть TelegramModule, добавляем мок TelegramService
  if (containsTelegramModule(imports)) {
    updatedProviders = addMockTelegramServiceToProviders(updatedProviders);
  }

  // Всегда добавляем TelegrafTokenProvider — упрощает настройку тестов и устраняет ошибки
    updatedProviders = addTelegrafTokenToProviders(updatedProviders);

  // Если в импортах есть TelegrafModule, добавляем TelegrafTokenProvider
  if (containsTelegrafModule(imports)) {
    updatedProviders = addTelegrafTokenToProviders(updatedProviders);
  }

  // Если в импортах есть LLMModule, добавляем мок LLMService
  if (containsLLMModule(imports)) {
    const config = { providers: updatedProviders };
    const updatedConfig = addLLMMocks(config);
    updatedProviders = updatedConfig.providers;
  }

  // Всегда добавляем моки для LoggingModule
  const config = { providers: updatedProviders };
  const updatedConfig = addLoggingMocks(config);
  updatedProviders = updatedConfig.providers;

  // Добавляем ConfigService, только если ConfigModule не импортирован (иначе конфиг уже доступен)
  const hasConfigModule = imports.some(
    imp => (imp as any)?.module === ConfigModule || imp === ConfigModule,
  );

  if (!hasConfigModule) {
  updatedProviders = addConfigServiceProvider(updatedProviders);
  }

  // Добавляем CacheService, если он ещё не добавлен
  const hasCacheService = updatedProviders.some(
    (p: any) => p === CacheService || p?.provide === CacheService,
  );

  if (!hasCacheService) {
    updatedProviders.push({
      provide: CacheService,
      useValue: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(null),
        has: jest.fn().mockResolvedValue(false),
        del: jest.fn().mockResolvedValue(false),
        delete: jest.fn().mockResolvedValue(false),
        clear: jest.fn().mockResolvedValue(null),
      },
    });
  }

  // Добавляем MockEventEmitter для EventEmitter2, если он ещё не добавлен
  const hasEventEmitter = updatedProviders.some(
    (p: any) => p === EventEmitter2 || p?.provide === EventEmitter2,
  );

  if (!hasEventEmitter) {
    updatedProviders.push({
      provide: EventEmitter2,
      useValue: new MockEventEmitter(),
    });
  }

  // Добавляем DATA_SOURCE для FixtureManager
  updatedProviders = addDataSourceProvider(updatedProviders);

  // Добавляем WINSTON_MODULE_PROVIDER, если его еще нет
  if (!updatedProviders.some(provider => (provider as any)?.provide === WINSTON_MODULE_PROVIDER)) {
    updatedProviders.push({
      provide: WINSTON_MODULE_PROVIDER,
      useValue: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      },
    });
  }

  // Добавляем телеграм-заглушки для обработчиков, если они не были предоставлены
  const telegramStubProviders: Provider[] = [];
  const telegramHandlerPaths = [
    '../mocks/telegram-handler-stubs', // We'll create aggregated export of stubs
  ];

  // Dynamically import handler classes to avoid heavy dependencies when not present
  let MessageHandler: any;
  let CommandHandler: any;
  let CallbackHandler: any;
  let TelegramUpdate: any;
  try {
    ({ MessageHandler } = require('../../../src/telegram/handlers/message.handler'));
  } catch {}
  try {
    ({ CommandHandler } = require('../../../src/telegram/handlers/command.handler'));
  } catch {}
  try {
    ({ CallbackHandler } = require('../../../src/telegram/handlers/callback.handler'));
  } catch {}
  try {
    ({ TelegramUpdate } = require('../../../src/telegram/telegram.update'));
  } catch {}

  const handlerClasses: any[] = [MessageHandler, CommandHandler, CallbackHandler, TelegramUpdate].filter(Boolean);

  handlerClasses.forEach(handlerClass => {
    if (!updatedProviders.some(p => p === handlerClass || (p as any)?.provide === handlerClass)) {
      telegramStubProviders.push({ provide: handlerClass, useValue: {} });
    }
  });

  // DialogRepository token заглушка
  const dialogRepositoryToken = 'DialogRepository';
  if (!updatedProviders.some(p => (p as any)?.provide === dialogRepositoryToken)) {
    telegramStubProviders.push({ provide: dialogRepositoryToken, useValue: {} });
  }

  updatedProviders = [...updatedProviders, ...telegramStubProviders];

  return updatedProviders;
}

/**
 * Заменяет TelegrafModule на MockTelegramModule.forRoot() в импортах
 * @param imports массив импортов модулей
 * @returns обновленный массив импортов с замененным TelegrafModule
 */
export function prepareImportsForTesting(
  imports: (Type<any> | DynamicModule)[] = [],
): (Type<any> | DynamicModule)[] {
  let updatedImports = [...imports];

  // Если в импортах есть TelegrafModule, заменяем его на MockTelegramModule.forRoot()
  if (containsTelegrafModule(updatedImports)) {
    updatedImports = replaceTelegrafModule(updatedImports);
  }

  // Если в импортах есть TelegramModule, заменяем его на MockTelegramModule.forRoot()
  if (containsTelegramModule(updatedImports)) {
    updatedImports = updatedImports.map(mod => {
      const moduleName = (mod as any)?.name || (mod as any)?.module?.name;
      if (moduleName === 'TelegramModule') {
        const { MockTelegramModule } = require('../mocks/mock-telegram.module');
        return MockTelegramModule.forRoot();
      }
      return mod;
    });
  }

  // Заменяем LoggingModule на MockLoggingModule.forRoot()
  updatedImports = updatedImports.map(mod => {
    // Если импорт — DynamicModule с module === LoggingModule
    if ((mod as any)?.module === LoggingModule) {
      return MockLoggingModule.forRoot();
    }
    if (mod === LoggingModule) {
      return MockLoggingModule.forRoot();
    }
    return mod;
  });

  // Ensure ConfigModule is imported at root for ConfigService availability with базовой тестовой конфигурацией
  if (!updatedImports.some(mod => (mod as any)?.module === ConfigModule || mod === ConfigModule)) {
    updatedImports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({
          security: {
            apiKey: 'test-api-key',
          },
          telegram: {
            token: 'test-telegram-token',
          },
          logging: {
            rollbar: {
              enabled: false,
              accessToken: '',
              environment: 'test',
              captureUncaught: false,
              captureUnhandledRejections: false,
            },
          },
          llm: {
            providers: [],
          },
        })],
      }) as unknown as DynamicModule,
    );
  }

  // Always include MockTypeOrmModule for DataSource availability
  if (!updatedImports.some(mod => (mod as any)?.module === MockTypeOrmModule || mod === MockTypeOrmModule)) {
    updatedImports.push(MockTypeOrmModule.forRoot());
  }

  // Ensure TelegrafTokenMockModule is imported to предоставлять TELEGRAF_TOKEN глобально
  const { TelegrafTokenMockModule } = require('../mocks/telegraf-token.module');
  if (!updatedImports.some(mod => (mod as any)?.module === TelegrafTokenMockModule || mod === TelegrafTokenMockModule)) {
    updatedImports.push(TelegrafTokenMockModule);
  }

  // Всегда добавляем MockTelegramModule.forRoot(), если он ещё не добавлен напрямую
  const { MockTelegramModule } = require('../mocks/mock-telegram.module');
  const hasMockTelegramModule = updatedImports.some(
    mod => (mod as any)?.module === MockTelegramModule || mod === MockTelegramModule,
  );
  if (!hasMockTelegramModule) {
    updatedImports.push(MockTelegramModule.forRoot());
  }

  // Ensure MockDialogRepositoryModule imported to satisfy DialogRepository DI
  if (!updatedImports.some(mod => (mod as any)?.module === MockDialogRepositoryModule || mod === MockDialogRepositoryModule)) {
    updatedImports.push(MockDialogRepositoryModule);
  }

  return updatedImports;
}

/**
 * Объект, содержащий функции для управления тестовыми конфигурациями
 */
export const TestConfigurations = {
  getDialogTestConfig,
  addMockUserServiceToProviders,
  mockUserService,
  containsDialogModule,
  requiredMocksAdder: (
    imports: (Type<any> | DynamicModule)[] = [],
    providers: Provider[] = [],
  ): Provider[] => {
    return requiredMocksAdder(imports, providers);
  },
  addConfigServiceProvider,
  addDataSourceProvider,
  addTelegrafTokenProvider,
  prepareImportsForTesting,
  addLoggingMocks: (providers: Provider[] = []): Provider[] => {
    const config = { providers };
    const updatedConfig = addLoggingMocks(config);
    return updatedConfig.providers;
  },
};

/**
 * Добавляет TelegrafTokenProvider в провайдеры для тестов Telegram
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленным TelegrafTokenProvider
 */
export function addTelegrafTokenProvider(providers: any[] = []): any[] {
  const hasTokenProvider = providers.some(
    (provider: any) =>
      provider === TelegrafTokenProvider ||
      (provider?.provide === (TelegrafTokenProvider as any).provide &&
        provider?.useValue === (TelegrafTokenProvider as any).useValue),
  );

  const hasToken = providers.some((provider: any) => provider?.provide === TELEGRAF_TOKEN);

  const updatedProviders = [...providers];

  if (!hasTokenProvider) {
    updatedProviders.push(TelegrafTokenProvider);
  }

  if (!hasToken) {
    updatedProviders.push({
      provide: TELEGRAF_TOKEN,
      useValue: 'test-telegram-token',
    });
  }

  return updatedProviders;
}

/**
 * Добавляет ConfigServiceProvider в провайдеры
 */
export function addConfigServiceProvider(providers: any[]): any[] {
  const hasConfigServiceProvider = providers.some(
    p => p === ConfigService || p?.provide === ConfigService || p?.provide === 'ConfigService',
  );

  if (hasConfigServiceProvider) {
    return providers;
  }

  return [
    ...providers,
    { provide: ConfigService, useValue: mockConfigService },
    { provide: 'ConfigService', useValue: mockConfigService },
  ];
}

/**
 * Добавляет DATA_SOURCE провайдер для FixtureManager
 */
export function addDataSourceProvider(providers: any[] = []): any[] {
  const dataSourceExists = providers.some((provider: any) => provider?.provide === 'DATA_SOURCE');

  if (!dataSourceExists) {
    providers.push({
      provide: 'DATA_SOURCE',
      useFactory: async () => {
        const { createTestDataSource } = require('../utils/data-source');
        const dataSource = await createTestDataSource();
        if (!dataSource.isInitialized) {
        await dataSource.initialize();
        }
        return dataSource;
      },
    });
    providers.push({
      provide: DataSource,
      useExisting: 'DATA_SOURCE',
    });
    providers.push({
      provide: 'DataSource',
      useExisting: 'DATA_SOURCE',
    });
  }

  return providers;
}