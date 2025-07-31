import { Injectable, LoggerService } from '@nestjs/common';
import { LogLevel } from '../../../src/logging/log.service';
import { MockRollbarService } from './rollbar.service.mock';

/**
 * Интерфейс для мока Winston Logger
 * Определяет методы логгера, которые будут использоваться в MockLogService
 */
interface MockWinstonLogger {
  info: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
  warn: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
  error: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
  debug: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
  verbose: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
  log: jest.Mock<void, [message: string, meta?: Record<string, any>]>;
}

/**
 * Мок LogService для использования в тестах
 * Имитирует все методы оригинального LogService, но не требует зависимостей
 *
 * Пример использования:
 * ```typescript
 * const mockLogService = new MockLogService();
 * mockLogService.info('Test message', { key: 'value' });
 * expect(mockLogService.info).toHaveBeenCalled();
 * ```
 */
@Injectable()
export class MockLogService implements LoggerService {
  protected context?: string;
  public readonly sendToRollbar: boolean = false;
  public readonly logLevel: LogLevel = LogLevel.DEBUG;

  /**
   * Мок ConfigService для совместимости с оригинальным LogService
   */
  public readonly configService: any = {
    get: jest.fn().mockReturnValue(true),
  };

  /**
   * Мок Winston логгера с методами jest.Mock для отслеживания вызовов
   */
  public readonly winstonLogger: MockWinstonLogger;

  /**
   * Мок Rollbar сервиса для логирования критических ошибок
   */
  public readonly rollbarService: MockRollbarService;

  // Jest spy методы для отслеживания вызовов
  public setContext = jest.fn();
  public log = jest.fn();
  public info = jest.fn();
  public debug = jest.fn();
  public warn = jest.fn();
  public error = jest.fn();
  public verbose = jest.fn();
  public critical = jest.fn();
  public forContext = jest.fn();

  constructor() {
    this.winstonLogger = {
      info: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
      warn: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
      error: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
      debug: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
      verbose: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
      log: jest.fn<void, [message: string, meta?: Record<string, any>]>(),
    };
    this.rollbarService = new MockRollbarService();

    // Настройка поведения spy методов
    this.setContext.mockImplementation((context: string) => {
      this.context = context;
      return this;
    });

    this.forContext.mockImplementation((context: string) => {
      const newLogger = new MockLogService();
      newLogger.setContext(context);
      return newLogger;
    });
  }

  /**
   * Очистка ресурсов при уничтожении модуля
   */
  onModuleDestroy(): void {
    // Заглушка
  }

  /**
   * Получить контекст логгера
   * @returns Текущий контекст логгера или 'TestContext' по умолчанию
   */
  getContext(): string | undefined {
    return this.context || 'TestContext';
  }

  /**
   * Приватный метод для форматирования сообщений
   * @param message Исходное сообщение
   * @returns Форматированное сообщение с контекстом
   */
  private formatMessage(message: string): string {
    return this.context ? `[${this.context}] ${message}` : message;
  }

  /**
   * Приватный метод для обогащения метаданных
   * @param meta Исходные метаданные
   * @returns Обогащенные метаданные с контекстом
   */
  private enrichMeta(meta?: Record<string, any>): Record<string, any> {
    return {
      ...meta,
      context: this.context || 'MockLogService',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Проверка необходимости логирования для указанного уровня
   * @param _level Уровень логирования для проверки
   * @returns Всегда true в mock-версии
   */
  private shouldLog(_level: LogLevel): boolean {
    return true;
  }
}
