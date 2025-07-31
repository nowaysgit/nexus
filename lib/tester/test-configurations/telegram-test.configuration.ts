/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string -- Dynamic module introspection requires any type access and string conversion */
import { Provider, Type, DynamicModule } from '@nestjs/common';
import { MockProviderFactory } from '../mocks';
import { MockTelegramModule } from '../mocks/mock-telegram.module';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';

/**
 * Проверяет, содержит ли список импортов TelegramModule
 * @param imports Массив импортов
 * @returns true если содержит TelegramModule, иначе false
 */
export function containsTelegramModule(imports: (Type<any> | DynamicModule)[]): boolean {
  if (!imports) {
    return false;
  }
  return imports.some(importedModule => {
    if (typeof importedModule === 'string') {
      return importedModule === 'TelegramModule';
    }
    const moduleName = (importedModule as any)?.name || (importedModule as any)?.module?.name;
    if (moduleName) {
      return moduleName === 'TelegramModule';
    }
    if (typeof importedModule.toString === 'function') {
      return importedModule.toString().includes('class TelegramModule');
    }
    return false;
  });
}

/**
 * Проверяет, содержит ли список импортов TelegrafModule
 * @param imports Массив импортов
 * @returns true если содержит TelegrafModule, иначе false
 */
export function containsTelegrafModule(imports: (Type<any> | DynamicModule)[]): boolean {
  if (!imports) {
    return false;
  }
  return imports.some(importedModule => {
    if (typeof importedModule === 'string') {
      return importedModule === 'TelegrafModule';
    }
    const moduleName = (importedModule as any)?.name || (importedModule as any)?.module?.name;
    if (moduleName) {
      return moduleName === 'TelegrafModule';
    }
    if (typeof importedModule.toString === 'function') {
      return importedModule.toString().includes('TelegrafModule');
    }
    return false;
  });
}

/**
 * Заменяет TelegrafModule на MockTelegramModule.forRoot() в импортах
 * @param imports Массив импортов
 * @returns Обновленный массив импортов с замененным TelegrafModule
 */
export function replaceTelegrafModule(
  imports: (Type<any> | DynamicModule)[],
): (Type<any> | DynamicModule)[] {
  if (!imports) {
    return [];
  }

  const updatedImports = [...imports];

  // Находим индекс TelegrafModule
  const telegrafModuleIndex = updatedImports.findIndex(importedModule => {
    if (typeof importedModule === 'string') {
      return importedModule === 'TelegrafModule';
    }
    const moduleName = (importedModule as any)?.name || (importedModule as any)?.module?.name;
    if (moduleName) {
      return moduleName === 'TelegrafModule';
    }
    if (typeof importedModule.toString === 'function') {
      return importedModule.toString().includes('TelegrafModule');
    }
    return false;
  });

  // Если нашли TelegrafModule, заменяем его на MockTelegramModule.forRoot()
  if (telegrafModuleIndex !== -1) {
    updatedImports[telegrafModuleIndex] = MockTelegramModule.forRoot();
  } else {
    // Если не нашли, добавляем MockTelegramModule.forRoot()
    updatedImports.push(MockTelegramModule.forRoot());
  }

  return updatedImports;
}

/**
 * Добавляет моки Telegram сервиса в провайдеры
 * @param providers Массив провайдеров
 * @returns Обновленный массив провайдеров с добавленными моками
 */
export function addMockTelegramServiceToProviders(providers: Provider[] = []): Provider[] {
  const mockProviders = MockProviderFactory.createTelegramProviderMocks();
  return [...providers, ...mockProviders];
}

/**
 * Добавляет токен Telegraf в провайдеры
 * @param providers Массив провайдеров
 * @returns Обновленный массив провайдеров с добавленным токеном
 */
export function addTelegrafTokenToProviders(providers: Provider[] = []): Provider[] {
  // Проверяем, есть ли уже TelegrafTokenProvider в провайдерах
  const hasTelegrafToken = providers.some(
    provider =>
      provider === TelegrafTokenProvider ||
      (typeof provider === 'object' && provider?.provide === 'TELEGRAF_TOKEN'),
  );

  if (hasTelegrafToken) {
    return providers;
  }

  return [...providers, TelegrafTokenProvider];
}

/**
 * Получает конфигурацию для тестов Telegram
 */
export function getTelegramTestConfig() {
  return {
    providers: MockProviderFactory.createTelegramProviderMocks(),
  };
}
