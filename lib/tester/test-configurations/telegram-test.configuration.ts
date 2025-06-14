import { Provider, Type, DynamicModule } from '@nestjs/common';
import { MockProviderFactory } from '../mocks';

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
  return [
    ...providers,
    {
      provide: 'TELEGRAF_TOKEN',
      useValue: 'test-telegram-token',
    },
  ];
}

/**
 * Получает конфигурацию для тестов Telegram
 */
export function getTelegramTestConfig() {
  return {
    providers: MockProviderFactory.createTelegramProviderMocks(),
  };
}
