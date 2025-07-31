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
 * Контекст логирования
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Абстрактный интерфейс логгера для common модуля
 * Позволяет избежать прямых зависимостей от конкретных реализаций
 */
export interface ILogger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  verbose(message: string, context?: LogContext): void;
  log(level: LogLevel, message: string, context?: LogContext): void;
  setContext(context: string): ILogger;
}

/**
 * Заглушка логгера для случаев, когда реальный логгер недоступен
 */
export class NoOpLogger implements ILogger {
  error(message: string, context?: LogContext): void {
    console.error(message, context);
  }

  warn(message: string, context?: LogContext): void {
    console.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    console.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    console.debug(message, context);
  }

  verbose(message: string, context?: LogContext): void {
    console.log(message, context);
  }

  log(level: LogLevel, message: string, context?: LogContext): void {
    console.log(`[${level.toUpperCase()}] ${message}`, context);
  }

  setContext(): ILogger {
    return this;
  }
}
