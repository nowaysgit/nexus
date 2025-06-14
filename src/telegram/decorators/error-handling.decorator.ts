import { LogService } from '../../logging/log.service';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

/**
 * Декоратор для автоматической обработки ошибок в методах
 */
export function WithErrorHandling(
  options: {
    errorMessage?: string;
    loggerContext?: string;
    defaultValue?: unknown;
  } = {},
) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const targetConstructor = target as { constructor: { name: string } };
    const logger = new LogService(null, null, null).setContext(
      options.loggerContext || targetConstructor.constructor.name,
    );

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const errorMessage = options.errorMessage || `выполнении метода ${propertyKey}`;

      return withErrorHandling(
        async () => originalMethod.apply(this, args) as Promise<unknown>,
        errorMessage,
        logger,
        { method: propertyKey, args },
        options.defaultValue,
      );
    };

    return descriptor;
  };
}
