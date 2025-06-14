import { LogService } from '../../logging/log.service';
import { measureExecutionTime } from '../../common/utils/error-handling/error-handling.utils';

/**
 * Декоратор для измерения времени выполнения метода
 */
export function MeasureExecutionTime(
  options: {
    operationName?: string;
    loggerContext?: string;
  } = {},
) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const targetConstructor = target as { constructor: { name: string } };
    const logger = new LogService(null, null, null).setContext(
      options.loggerContext || targetConstructor.constructor.name,
    );

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const operationName = options.operationName || `метод ${propertyKey}`;

      return measureExecutionTime(
        async () => originalMethod.apply(this, args) as Promise<unknown>,
        operationName,
        logger,
      );
    };

    return descriptor;
  };
}
