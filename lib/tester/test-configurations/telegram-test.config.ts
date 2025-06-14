import { Provider } from '@nestjs/common';
import { TelegrafTokenProvider } from '../mocks/telegraf-token.provider';
import { mockTelegramService } from '../mocks/telegram-service.mock';
import { TelegramService } from '../../../src/telegram/telegram.service';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';

/**
 * Получить тестовую конфигурацию для TelegramModule
 */
export function getTelegramTestConfig(): { providers: Provider[] } {
  return {
    providers: [
      TelegrafTokenProvider,
      {
        provide: TelegramService,
        useValue: mockTelegramService,
      },
    ],
  };
}

/**
 * Проверить наличие TelegramModule в импортах
 */
export function containsTelegramModule(imports: any[] = []): boolean {
  return imports.some(
    module =>
      module &&
      (module.name === 'TelegramModule' ||
        (typeof module === 'object' && module.module && module.module.name === 'TelegramModule')),
  );
}

/**
 * Добавить mockTelegramService в провайдеры
 */
export function addMockTelegramServiceToProviders(providers: any[] = []): any[] {
  // Проверяем, что провайдер еще не добавлен
  const mockProvider = {
    provide: TelegramService,
    useValue: mockTelegramService,
  };

  const alreadyAdded = providers.some(provider => {
    if (typeof provider === 'object' && provider !== null) {
      return provider.provide === TelegramService;
    }
    return false;
  });

  if (!alreadyAdded) {
    return [...providers, mockProvider];
  }

  return providers;
}

/**
 * Добавить TELEGRAF_TOKEN в провайдеры
 */
export function addTelegrafTokenToProviders(providers: any[] = []): any[] {
  // Проверяем, что провайдер еще не добавлен
  const alreadyAdded = providers.some(provider => {
    if (provider === TelegrafTokenProvider) {
      return true;
    }
    if (typeof provider === 'object' && provider !== null) {
      return provider.provide === TELEGRAF_TOKEN;
    }
    return false;
  });

  if (!alreadyAdded) {
    return [...providers, TelegrafTokenProvider];
  }

  return providers;
}
