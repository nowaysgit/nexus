import { Injectable, Inject, LoggerService, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RollbarService } from './rollbar.service';

/**
 * Уровни логирования
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * Интерфейс для типизации Winston Logger
 */
interface WinstonLogMethod {
  (message: string, meta?: Record<string, any>): void;
}

interface WinstonLogger {
  info: WinstonLogMethod;
  warn: WinstonLogMethod;
  error: WinstonLogMethod;
  debug: WinstonLogMethod;
  verbose: WinstonLogMethod;
}

/**
 * Упрощенный сервис логирования
 * Заменяет переусложненный LogService простой реализацией основной функциональности
 * Убрана избыточная сложность: трассировка, фильтрация, персистенция, статистика
 */
@Injectable()
export class LogService implements LoggerService, OnModuleDestroy {
  private context?: string;
  private readonly sendToRollbar: boolean;
  private readonly logLevel: LogLevel;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
    private readonly rollbarService: RollbarService,
    private readonly configService: ConfigService,
  ) {
    this.sendToRollbar = this.configService.get<boolean>('logging.rollbar.enabled', false);
    this.logLevel = this.configService.get<LogLevel>('logging.logger.level', LogLevel.INFO);
  }

  onModuleDestroy(): void {
    // Простая очистка без сложной логики
  }

  /**
   * Установить контекст для логгера
   */
  setContext(context: string): LogService {
    this.context = context;
    return this;
  }

  /**
   * Получить контекст логгера
   */
  getContext(): string | undefined {
    return this.context;
  }

  /**
   * Создать новый логгер с контекстом
   */
  forContext(context: string): LogService {
    const newLogger = new LogService(this.winstonLogger, this.rollbarService, this.configService);
    newLogger.setContext(context);
    return newLogger;
  }

  /**
   * Основной метод логирования
   */
  log(message: string, context?: string | Record<string, any>): void {
    this.info(message, typeof context === 'object' ? context : { context });
  }

  /**
   * Информационное сообщение
   */
  info(message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const enrichedMeta = this.enrichMeta(meta);
    this.winstonLogger.info(this.formatMessage(message), enrichedMeta);
  }

  /**
   * Отладочное сообщение
   */
  debug(message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const enrichedMeta = this.enrichMeta(meta);
    this.winstonLogger.debug(this.formatMessage(message), enrichedMeta);
  }

  /**
   * Предупреждение
   */
  warn(message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const enrichedMeta = this.enrichMeta(meta);
    this.winstonLogger.warn(this.formatMessage(message), enrichedMeta);

    // Отправляем в Rollbar если включено
    if (this.sendToRollbar) {
      this.rollbarService.warn(message, enrichedMeta);
    }
  }

  /**
   * Подробное сообщение
   */
  verbose(message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.VERBOSE)) return;

    const enrichedMeta = this.enrichMeta(meta);
    this.winstonLogger.verbose(this.formatMessage(message), enrichedMeta);
  }

  /**
   * Сообщение об ошибке
   */
  error(
    message: string | Error,
    metaOrTrace?: Record<string, any> | string,
    contextOrMeta?: Record<string, any> | string,
  ): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    let errorMessage: string;
    let meta: Record<string, any> = {};

    // Обработка различных форматов входных параметров
    if (message instanceof Error) {
      errorMessage = message.message;
      meta.stack = message.stack;
      meta.name = message.name;

      if (typeof metaOrTrace === 'object') {
        meta = { ...meta, ...metaOrTrace };
      } else if (typeof metaOrTrace === 'string') {
        meta.trace = metaOrTrace;
      }
    } else {
      errorMessage = message;

      if (typeof metaOrTrace === 'object') {
        meta = { ...meta, ...metaOrTrace };
      } else if (typeof metaOrTrace === 'string') {
        meta.trace = metaOrTrace;

        if (typeof contextOrMeta === 'object') {
          meta = { ...meta, ...contextOrMeta };
        }
      }
    }

    const enrichedMeta = this.enrichMeta(meta);
    this.winstonLogger.error(this.formatMessage(errorMessage), enrichedMeta);

    // Отправляем в Rollbar если включено
    if (this.sendToRollbar) {
      if (message instanceof Error) {
        this.rollbarService.error(message, enrichedMeta);
      } else {
        this.rollbarService.error(new Error(errorMessage), enrichedMeta);
      }
    }
  }

  /**
   * Критическая ошибка
   */
  critical(error: Error, meta?: Record<string, any>): void {
    const enrichedMeta = this.enrichMeta({
      ...meta,
      level: 'critical',
      stack: error.stack,
      name: error.name,
    });

    this.winstonLogger.error(this.formatMessage(`CRITICAL: ${error.message}`), enrichedMeta);

    // Всегда отправляем критические ошибки в Rollbar
    if (this.rollbarService) {
      this.rollbarService.critical(error, enrichedMeta);
    }
  }

  // ======= ПРИВАТНЫЕ МЕТОДЫ =======

  /**
   * Проверяет, нужно ли логировать сообщение данного уровня
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.VERBOSE];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Форматирует сообщение с контекстом
   */
  private formatMessage(message: string): string {
    return this.context ? `[${this.context}] ${message}` : message;
  }

  /**
   * Обогащает метаданные контекстной информацией
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
