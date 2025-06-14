import { Injectable, LoggerService } from '@nestjs/common';
import { LogLevel } from '../../../src/logging/log.service';
import { MockRollbarService } from './rollbar.service.mock';

/**
 * Интерфейс для мока Winston Logger
 */
interface MockWinstonLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  verbose: jest.Mock;
}

/**
 * Мок LogService для использования в тестах
 * Имитирует все методы оригинального LogService, но не требует зависимостей
 */
@Injectable()
export class MockLogService implements LoggerService {
  private context?: string;
  public readonly sendToRollbar: boolean = false;
  public readonly logLevel: LogLevel = LogLevel.DEBUG;
  public readonly winstonLogger: MockWinstonLogger;
  public readonly rollbarService: MockRollbarService;

  constructor() {
    this.winstonLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    this.rollbarService = new MockRollbarService();
  }

  /**
   * Очистка ресурсов при уничтожении модуля
   */
  onModuleDestroy(): void {
    // Заглушка
  }

  /**
   * Установить контекст для логгера
   */
  setContext(context: string): MockLogService {
    this.context = context;
    return this;
  }

  /**
   * Получить контекст логгера
   */
  getContext(): string | undefined {
    return this.context || 'TestContext';
  }

  /**
   * Создать новый логгер с контекстом
   */
  forContext(context: string): MockLogService {
    const newLogger = new MockLogService();
    newLogger.setContext(context);
    return newLogger;
  }

  /**
   * Основной метод логирования
   */
  log(message: string, context?: string | Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK LOG] ${this.context || 'global'}: ${message}`);
  }

  /**
   * Информационное сообщение
   */
  info(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK INFO] ${this.context || 'global'}: ${message}`);
  }

  /**
   * Отладочное сообщение
   */
  debug(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK DEBUG] ${this.context || 'global'}: ${message}`);
  }

  /**
   * Предупреждение
   */
  warn(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK WARN] ${this.context || 'global'}: ${message}`);
  }

  /**
   * Подробное сообщение
   */
  verbose(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK VERBOSE] ${this.context || 'global'}: ${message}`);
  }

  /**
   * Сообщение об ошибке
   */
  error(
    message: string | Error,
    metaOrTrace?: Record<string, any> | string,
    contextOrMeta?: Record<string, any> | string,
  ): void {
    // Заглушка
    const errorMessage = message instanceof Error ? message.message : message;
    console.error(`[MOCK ERROR] ${this.context || 'global'}: ${errorMessage}`);
  }

  /**
   * Критическая ошибка
   */
  critical(error: Error, meta?: Record<string, any>): void {
    // Заглушка
    console.error(`[MOCK CRITICAL] ${this.context || 'global'}: ${error.message}`);
    this.winstonLogger.error.mock.calls.push([`CRITICAL: ${error.message}`, { ...meta, context: this.context, stack: error.stack }]);
  }
} 