import { LogService } from '../../../logging/log.service';
import { ErrorHandlingService } from './error-handling.service';

/**
 * Утилитарные функции для обработки ошибок без DI
 * Используют статические методы ErrorHandlingService
 */

/**
 * Оборачивает асинхронную операцию, обрабатывая возможные ошибки
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  logger: LogService,
  meta?: Record<string, unknown>,
  defaultValue?: T,
): Promise<T> {
  return ErrorHandlingService.withErrorHandling(
    operation,
    errorMessage,
    logger,
    meta,
    defaultValue,
  );
}

/**
 * Логирует ошибку с помощью предоставленного логгера
 */
export function logError(
  logger: LogService,
  operation: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  return ErrorHandlingService.logError(logger, operation, error, meta);
}

/**
 * Измеряет время выполнения операции
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
  operationName: string,
  logger: LogService,
): Promise<T> {
  return ErrorHandlingService.measureExecutionTime(operation, operationName, logger);
}

// Экспорты типов и интерфейсов для совместимости
export { SafeOperationResult } from './error-handling.service';
export { ErrorType } from '../../../common/interfaces/error-handler.interface';
export type { SessionData } from '../../../telegram/interfaces/context.interface';
