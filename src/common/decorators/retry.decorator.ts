import { LogService } from '../../logging/log.service';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Опции для декоратора повторных попыток
 */
export interface RetryOptions {
  /** Максимальное количество попыток */
  maxRetries?: number;
  /** Задержка между попытками в миллисекундах */
  delay?: number;
  /** Массив задержек для каждой попытки (альтернатива delay) */
  delays?: number[];
  /** Множитель для экспоненциального увеличения задержки */
  backoffFactor?: number;
  /** Максимальная задержка в миллисекундах */
  maxDelay?: number;
  /** Типы ошибок, для которых нужно выполнять повторные попытки */
  retryableErrors?: Array<new (...args: unknown[]) => Error>;
  /** Функция условия для повторной попытки */
  retryCondition?: (error: Error) => boolean;
  /** Callback-функция, вызываемая при повторной попытке */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Декоратор для повторных попыток выполнения метода
 * @param options Опции повторных попыток
 */
export function Retry(options: RetryOptions = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    delays,
    backoffFactor = 2,
    maxDelay = 10000,
    retryableErrors,
    retryCondition,
    onRetry,
  } = options;

  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      let retries = 0;
      let currentDelay = delay;

      // Используем логгер инстанса, если он доступен
      const logger =
        (this as { logService: LogService }).logService instanceof LogService
          ? (this as { logService: LogService }).logService
          : null;

      while (true) {
        try {
          return (await originalMethod.apply(this, args)) as unknown;
        } catch (error) {
          const errorInstance = error instanceof Error ? error : new Error(String(error));
          const errorMessage = getErrorMessage(errorInstance);
          const errorStack = errorInstance.stack;

          // Проверяем, нужно ли повторить попытку для данного типа ошибки
          let shouldRetry = true;

          // Проверка по типу ошибки
          if (retryableErrors && retryableErrors.length > 0) {
            shouldRetry = retryableErrors.some(errorType => errorInstance instanceof errorType);
          }

          // Дополнительная проверка по условию
          if (shouldRetry && retryCondition) {
            shouldRetry = retryCondition(errorInstance);
          }

          if (!shouldRetry || retries >= maxRetries) {
            // Если это последняя попытка или ошибка не подлежит повтору, выбрасываем её
            throw errorInstance;
          }

          retries++;

          // Определяем задержку: из массива или по формуле
          if (delays && delays.length > 0) {
            currentDelay = delays[Math.min(retries - 1, delays.length - 1)];
          } else {
            currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
          }

          // Логируем информацию о повторной попытке
          if (logger) {
            logger.warn(
              `Ошибка при выполнении метода ${propertyKey}, повторная попытка ${retries}/${maxRetries} через ${currentDelay}ms`,
              {
                method: propertyKey,
                attempt: retries,
                maxRetries,
                delay: currentDelay,
                error: {
                  message: errorMessage,
                  stack: errorStack,
                },
              },
            );
          }

          // Вызываем callback-функцию, если она предоставлена
          if (onRetry) {
            try {
              onRetry(errorInstance, retries);
            } catch (callbackError) {
              // Игнорируем ошибки в callback, чтобы не прерывать процесс повторных попыток
              if (logger) {
                const errorMessage =
                  callbackError instanceof Error ? callbackError.message : 'Неизвестная ошибка';
                logger.error(`Ошибка в onRetry callback: ${errorMessage}`);
              }
            }
          }

          // Ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      }
    };

    return descriptor;
  };
}
