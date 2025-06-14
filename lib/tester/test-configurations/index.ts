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
} from './telegram-test.configuration';
import { addLoggingMocks } from './logging-test.configuration';
import { addLLMMocks, containsLLMModule } from './llm-test.configuration';
import { ConfigServiceProvider } from '../mocks/config.service.mock';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';

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

  // Если в импортах есть TelegramModule, добавляем мок TelegramService и TELEGRAF_TOKEN
  if (containsTelegramModule(imports)) {
    updatedProviders = addMockTelegramServiceToProviders(updatedProviders);
    updatedProviders = addTelegrafTokenToProviders(updatedProviders);
  } else if (
    updatedProviders.some(provider => {
      const p: any = provider;
      return (
        p?.provide === 'TelegramService' ||
        p?.provide?.name === 'TelegramService' ||
        (typeof provider === 'function' && (provider as any).name === 'TelegramService')
      );
    })
  ) {
    // Если в провайдерах есть TelegramService, но нет TelegramModule в импортах,
    // всё равно добавляем TelegrafTokenProvider
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

  // Добавляем ConfigService
  updatedProviders = addConfigServiceProvider(updatedProviders);

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

  return updatedProviders;
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

  /**
   * Добавляет моки для LogService и RollbarService в провайдеры
   * Использование:
   * ```
   * const moduleRef = await Test.createTestingModule({
   *   imports: [...],
   *   providers: TestConfigurations.addLoggingMocks([...ваши провайдеры...]),
   * }).compile();
   * ```
   */
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
  // Проверяем, что TelegrafTokenProvider и TELEGRAF_TOKEN еще не добавлены
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
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленным ConfigServiceProvider
 */
export function addConfigServiceProvider(providers: any[]): any[] {
  if (providers.some(p => p?.provide === 'ConfigService')) {
    return providers;
  }

  return [...providers, ConfigServiceProvider];
}

/**
 * Добавляет DATA_SOURCE провайдер для FixtureManager
 * @param providers массив провайдеров
 * @returns обновленный массив провайдеров с добавленным DATA_SOURCE
 */
export function addDataSourceProvider(providers: any[] = []): any[] {
  // Проверяем, что DATA_SOURCE еще не добавлен
  const dataSourceExists = providers.some((provider: any) => provider?.provide === 'DATA_SOURCE');

  if (!dataSourceExists) {
    providers.push({
      provide: 'DATA_SOURCE',
      useFactory: async () => {
        const { createTestDataSource } = require('../utils/data-source');
        const dataSource = await createTestDataSource();
        await dataSource.initialize();
        return dataSource;
      },
    });
  }

  return providers;
}
