import { LogService } from '../../logging/log.service';

/**
 * Базовый абстрактный класс для всех сервисов приложения
 * Предоставляет общую функциональность:
 * - Автоматическая инициализация логгера с контекстом
 * - Универсальный обработчик ошибок withErrorHandling
 * - Стандартизированное логирование
 */
export abstract class BaseService {
  protected logService: LogService;

  constructor(logService: LogService) {
    // Автоматическая инициализация логгера с контекстом класса
    if (logService && typeof logService.setContext === 'function') {
      this.logService = logService.setContext(this.constructor.name);
    } else {
      this.logService = logService;
    }
  }

  /**
   * Универсальный обработчик ошибок для методов сервиса
   * @param operation Название операции для логирования
   * @param fn Функция для выполнения
   * @returns Результат выполнения функции или выброс ошибки
   */
  protected async withErrorHandling<T>(operation: string, fn: () => Promise<T> | T): Promise<T> {
    try {
      if (this.logService && typeof this.logService.debug === 'function') {
        this.logService.debug(`Начало выполнения операции: ${operation}`);
      }
      const result = await fn();
      if (this.logService && typeof this.logService.debug === 'function') {
        this.logService.debug(`Операция завершена успешно: ${operation}`);
      }
      return result;
    } catch (error) {
      const errorMessage = `Ошибка при выполнении операции "${operation}"`;
      if (this.logService && typeof this.logService.error === 'function') {
        this.logService.error(errorMessage, {
          operation,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw error;
    }
  }

  /**
   * Синхронная версия обработчика ошибок
   * @param operation Название операции для логирования
   * @param fn Функция для выполнения
   * @returns Результат выполнения функции или выброс ошибки
   */
  protected withErrorHandlingSync<T>(operation: string, fn: () => T): T {
    try {
      if (this.logService && typeof this.logService.debug === 'function') {
        this.logService.debug(`Начало выполнения операции: ${operation}`);
      }
      const result = fn();
      if (this.logService && typeof this.logService.debug === 'function') {
        this.logService.debug(`Операция завершена успешно: ${operation}`);
      }
      return result;
    } catch (error) {
      const errorMessage = `Ошибка при выполнении операции "${operation}"`;
      if (this.logService && typeof this.logService.error === 'function') {
        this.logService.error(errorMessage, {
          operation,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw error;
    }
  }

  /**
   * Логирование информационного сообщения
   * @param message Сообщение для логирования
   * @param meta Дополнительные метаданные
   */
  protected logInfo(message: string, meta?: Record<string, any>): void {
    if (this.logService && typeof this.logService.log === 'function') {
      this.logService.log(message, meta);
    }
  }

  /**
   * Логирование предупреждения
   * @param message Сообщение для логирования
   * @param meta Дополнительные метаданные
   */
  protected logWarning(message: string, meta?: Record<string, any>): void {
    if (this.logService && typeof this.logService.warn === 'function') {
      this.logService.warn(message, meta);
    }
  }

  /**
   * Логирование ошибки
   * @param message Сообщение для логирования
   * @param meta Дополнительные метаданные
   */
  protected logError(message: string, meta?: Record<string, any>): void {
    if (this.logService && typeof this.logService.error === 'function') {
      this.logService.error(message, meta);
    }
  }

  /**
   * Логирование отладочного сообщения
   * @param message Сообщение для логирования
   * @param meta Дополнительные метаданные
   */
  protected logDebug(message: string, meta?: Record<string, any>): void {
    if (this.logService && typeof this.logService.debug === 'function') {
      this.logService.debug(message, meta);
    }
  }
}
