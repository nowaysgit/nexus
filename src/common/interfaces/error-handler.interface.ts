import { ILogger } from './logger.interface';

/**
 * Результат безопасной операции
 */
export interface SafeOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Тип ошибки для категоризации
 */
export enum ErrorType {
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  NETWORK = 'network',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

/**
 * Абстрактный интерфейс для обработки ошибок
 */
export interface IErrorHandler {
  /**
   * Выполняет операцию с обработкой ошибок
   */
  withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    logger?: ILogger,
    metadata?: Record<string, any>,
    defaultValue?: T,
  ): Promise<T>;

  /**
   * Логирует ошибку
   */
  logError(error: Error, context: string, logger?: ILogger, metadata?: Record<string, any>): void;

  /**
   * Определяет тип ошибки
   */
  categorizeError(error: Error): ErrorType;

  /**
   * Выполняет безопасную операцию
   */
  safeExecute<T>(operation: () => Promise<T>, context?: string): Promise<SafeOperationResult<T>>;
}

/**
 * Базовая реализация error handler
 */
export class BaseErrorHandler implements IErrorHandler {
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    logger?: ILogger,
    metadata?: Record<string, any>,
    defaultValue?: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logError(
        error instanceof Error ? error : new Error(String(error)),
        context,
        logger,
        metadata,
      );

      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw error;
    }
  }

  logError(error: Error, context: string, logger?: ILogger, metadata?: Record<string, any>): void {
    const errorType = this.categorizeError(error);
    const logContext = {
      errorType,
      context,
      errorMessage: error.message,
      stack: error.stack,
      ...metadata,
    };

    if (logger) {
      logger.error(`Ошибка в ${context}: ${error.message}`, logContext);
    } else {
      console.error(`Ошибка в ${context}: ${error.message}`, logContext);
    }
  }

  categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('network') || message.includes('timeout')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('database') || message.includes('sql')) {
      return ErrorType.DATABASE;
    }
    if (message.includes('auth')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('not found') || message.includes('404')) {
      return ErrorType.NOT_FOUND;
    }
    if (message.includes('rate limit')) {
      return ErrorType.RATE_LIMIT;
    }

    return ErrorType.UNKNOWN;
  }

  async safeExecute<T>(
    operation: () => Promise<T>,
    context?: string,
  ): Promise<SafeOperationResult<T>> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (context) {
        this.logError(err, context);
      }
      return { success: false, error: err };
    }
  }
}
