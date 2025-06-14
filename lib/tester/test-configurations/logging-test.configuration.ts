import { Provider } from '@nestjs/common';
import { LogService } from '../../../src/logging/log.service';
import { RollbarService } from '../../../src/logging/rollbar.service';
import { MockLogService, MockRollbarService } from '../mocks';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

/**
 * Создает провайдеры для тестирования с мокированными LogService и RollbarService
 * @returns Массив провайдеров для тестирования
 */
export function getLoggingTestProviders(): Provider[] {
  return [
    {
      provide: LogService,
      useClass: MockLogService,
    },
    {
      provide: RollbarService,
      useClass: MockRollbarService,
    },
    {
      provide: WINSTON_MODULE_PROVIDER,
      useValue: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      },
    },
  ];
}

/**
 * Добавляет необходимые моки для логирования в тестовую конфигурацию
 * @param config Текущая конфигурация тестов
 * @returns Обновленная конфигурация с мокированными сервисами логирования
 */
export function addLoggingMocks<T extends { providers?: Provider[] }>(
  config: T
): T {
  const providers = config.providers || [];
  
  // Проверяем, есть ли уже моки для LogService и RollbarService
  const hasLogServiceMock = providers.some(
    provider => 
      provider && (
      (provider as any).provide === LogService ||
        (typeof provider === 'function' && provider === LogService) ||
        ((provider as any).provide && (provider as any).provide.name === 'LogService')
      )
  );
  
  const hasRollbarServiceMock = providers.some(
    provider => 
      provider && (
      (provider as any).provide === RollbarService ||
        (typeof provider === 'function' && provider === RollbarService) ||
        ((provider as any).provide && (provider as any).provide.name === 'RollbarService')
      )
  );
  
  const hasWinstonProviderMock = providers.some(
    provider => 
      provider && (
        (provider as any).provide === WINSTON_MODULE_PROVIDER
      )
  );
  
  // Добавляем моки, если их еще нет
  if (!hasLogServiceMock) {
    providers.push({
      provide: LogService,
      useClass: MockLogService,
    });
  }
  
  if (!hasRollbarServiceMock) {
    providers.push({
      provide: RollbarService,
      useClass: MockRollbarService,
    });
  }
  
  if (!hasWinstonProviderMock) {
    providers.push({
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
  
  return {
    ...config,
    providers,
  };
} 