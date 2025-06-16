import { Injectable } from '@nestjs/common';

/**
 * Интерфейс для хранения вызовов методов мока
 */
interface MockCalls {
  info: Array<[message: string, extra?: Record<string, any>]>;
  debug: Array<[message: string, extra?: Record<string, any>]>;
  warn: Array<[message: string | Error, extra?: Record<string, any>]>;
  error: Array<[error: Error, extra?: Record<string, any>]>;
  critical: Array<[error: Error, extra?: Record<string, any>]>;
}

/**
 * Мок RollbarService для использования в тестах
 * Имитирует все методы оригинального RollbarService, но не требует ConfigService
 *
 * Пример использования:
 * ```typescript
 * const mockRollbarService = new MockRollbarService();
 * mockRollbarService.critical(new Error('Test error'), { userId: '123' });
 * expect(mockRollbarService.mockCalls.critical.length).toBeGreaterThan(0);
 * ```
 */
@Injectable()
export class MockRollbarService {
  /**
   * Флаг, указывающий, включен ли сервис Rollbar
   */
  public readonly enabled = true; // Изменено на true, чтобы моки всегда работали

  /**
   * Хранилище вызовов методов для проверки в тестах
   */
  public readonly mockCalls: MockCalls = {
    info: [],
    debug: [],
    warn: [],
    error: [],
    critical: [],
  };

  constructor() {
    // Мок не требует реальной конфигурации
  }

  onModuleInit(): void {
    // Нет необходимости в инициализации
  }

  /**
   * Логирует информационное сообщение
   * @param message Сообщение для логирования
   * @param extra Дополнительные данные
   */
  info(message: string, extra?: Record<string, any>): void {
    console.log(`[MOCK ROLLBAR INFO] ${message}`);
    this.mockCalls.info.push([message, extra]);
  }

  /**
   * Логирует сообщение с уровнем debug
   * @param message Сообщение для логирования
   * @param extra Дополнительные данные
   */
  debug(message: string, extra?: Record<string, any>): void {
    console.log(`[MOCK ROLLBAR DEBUG] ${message}`);
    this.mockCalls.debug.push([message, extra]);
  }

  /**
   * Логирует предупреждающее сообщение
   * @param message Строка с сообщением или объект Error
   * @param extra Дополнительные данные
   */
  warn(message: string | Error, extra?: Record<string, any>): void {
    const messageText = message instanceof Error ? message.message : message;
    console.log(`[MOCK ROLLBAR WARNING] ${messageText}`);
    this.mockCalls.warn.push([message, extra]);
  }

  /**
   * Логирует ошибку
   * @param error Объект Error
   * @param extra Дополнительные данные
   */
  error(error: Error, extra?: Record<string, any>): void {
    console.error(`[MOCK ROLLBAR ERROR] ${error.message}`);
    this.mockCalls.error.push([error, extra]);
  }

  /**
   * Логирует критическую ошибку
   * @param error Объект Error
   * @param extra Дополнительные данные
   */
  critical(error: Error, extra?: Record<string, any>): void {
    console.error(`[MOCK ROLLBAR CRITICAL] ${error.message}`);
    this.mockCalls.critical.push([error, extra]);
  }

  /**
   * Сбрасывает все моки
   */
  reset(): void {
    Object.keys(this.mockCalls).forEach(key => {
      this.mockCalls[key as keyof MockCalls] = [];
    });
  }
}
