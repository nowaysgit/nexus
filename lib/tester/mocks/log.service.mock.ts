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
 * expect(mockLogService.winstonLogger.info).toHaveBeenCalled();
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
  }

  /**
   * Очистка ресурсов при уничтожении модуля
   */
  onModuleDestroy(): void {
    // Заглушка
  }

  /**
   * Установить контекст для логгера
   * @param context Название контекста
   * @returns Текущий экземпляр логгера с установленным контекстом
   */
  setContext(context: string): MockLogService {
    this.context = context;
    return this;
  }

  /**
   * Получить контекст логгера
   * @returns Текущий контекст логгера или 'TestContext' по умолчанию
   */
  getContext(): string | undefined {
    return this.context || 'TestContext';
  }

  /**
   * Создать новый логгер с контекстом
   * @param context Название контекста для нового логгера
   * @returns Новый экземпляр логгера с установленным контекстом
   */
  forContext(context: string): MockLogService {
    const newLogger = new MockLogService();
    newLogger.setContext(context);
    return newLogger;
  }

  /**
   * Основной метод логирования
   * @param message Сообщение для логирования
   * @param context Контекст или метаданные
   */
  log(message: string, context?: string | Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK LOG] ${this.context || 'global'}: ${message}`);
    this.winstonLogger.log(
      this.formatMessage(message),
      typeof context === 'object' && context !== null ? context : context ? { context } : undefined,
    );
  }

  /**
   * Информационное сообщение
   * @param message Сообщение для логирования
   * @param meta Метаданные
   */
  info(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK INFO] ${this.context || 'global'}: ${message}`);
    // Вызываем метод winstonLogger.info для имитации работы оригинального сервиса
    this.winstonLogger.info(this.formatMessage(message), this.enrichMeta(meta));
  }

  /**
   * Отладочное сообщение
   * @param message Сообщение для логирования
   * @param meta Метаданные
   */
  debug(message: string, meta?: Record<string, any>): void {
    // Заглушка
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    console.log(`[MOCK DEBUG] ${this.context || 'global'}: ${message}${metaStr}`);
    this.winstonLogger.debug(this.formatMessage(message), this.enrichMeta(meta));
  }

  /**
   * Предупреждение
   * @param message Сообщение для логирования
   * @param meta Метаданные
   */
  warn(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK WARN] ${this.context || 'global'}: ${message}`);
    this.winstonLogger.warn(this.formatMessage(message), this.enrichMeta(meta));
  }

  /**
   * Подробное сообщение
   * @param message Сообщение для логирования
   * @param meta Метаданные
   */
  verbose(message: string, meta?: Record<string, any>): void {
    // Заглушка
    console.log(`[MOCK VERBOSE] ${this.context || 'global'}: ${message}`);
    this.winstonLogger.verbose(this.formatMessage(message), this.enrichMeta(meta));
  }

  /**
   * Сообщение об ошибке
   * @param message Строка с сообщением или объект Error
   * @param metaOrTrace Метаданные или строка со стеком вызовов
   * @param _contextOrMeta Дополнительный контекст или метаданные
   */
  error(
    message: string | Error,
    metaOrTrace?: Record<string, any> | string,
    _contextOrMeta?: Record<string, any> | string,
  ): void {
    // Заглушка
    const errorMessage = message instanceof Error ? message.message : message;
    console.error(`[MOCK ERROR] ${this.context || 'global'}: ${errorMessage}`);

    // Подготовка метаданных
    let meta: Record<string, any> = {};

    if (message instanceof Error) {
      meta.stack = message.stack;
      meta.name = message.name;

      if (typeof metaOrTrace === 'object') {
        meta = { ...meta, ...metaOrTrace };
      } else if (typeof metaOrTrace === 'string') {
        meta.trace = metaOrTrace;
      }
    } else {
      if (typeof metaOrTrace === 'object') {
        meta = { ...meta, ...metaOrTrace };
      }
    }

    // Вызываем метод winstonLogger.error для имитации работы оригинального сервиса
    this.winstonLogger.error(this.formatMessage(errorMessage), this.enrichMeta(meta));
  }

  /**
   * Критическая ошибка
   * @param error Объект Error
   * @param meta Метаданные
   */
  critical(error: Error, meta?: Record<string, any>): void {
    // Заглушка
    console.error(`[MOCK CRITICAL] ${this.context || 'global'}: ${error.message}`);

    const enrichedMeta = this.enrichMeta({
      ...meta,
      level: 'critical',
      stack: error.stack,
      name: error.name,
    });

    this.winstonLogger.error(this.formatMessage(`CRITICAL: ${error.message}`), enrichedMeta);

    // Имитируем вызов rollbarService.critical
    this.rollbarService.critical(error, enrichedMeta);
  }

  /**
   * Проверка, следует ли логировать сообщение данного уровня
   * @param level Уровень логирования
   * @returns true, если сообщение должно быть записано
   */
  private shouldLog(level: LogLevel): boolean {
    // В тестах всегда логируем все уровни
    return true;
  }

  /**
   * Форматирует сообщение с контекстом
   * @param message Исходное сообщение
   * @returns Отформатированное сообщение с контекстом
   */
  private formatMessage(message: string): string {
    return this.context ? `[${this.context}] ${message}` : message;
  }

  /**
   * Обогащает метаданные контекстной информацией
   * @param meta Исходные метаданные
   * @returns Обогащенные метаданные
   */
  private enrichMeta(meta: Record<string, any> = {}): Record<string, any> {
    const enriched: Record<string, any> = {
      ...meta,
      timestamp: new Date().toISOString(),
    };

    if (this.context) {
      enriched.context = this.context;
    }

    return enriched;
  }
}
