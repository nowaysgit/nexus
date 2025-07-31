/**
 * Декоратор для автоматической обработки ошибок в методах
 * Теперь работает с BaseService
 */

// Интерфейс для объектов с методом withErrorHandling
interface WithErrorHandlingCapable {
  withErrorHandling: <T>(errorMessage: string, operation: () => Promise<T>) => Promise<T>;
}

export function WithErrorHandling(
  options: {
    errorMessage?: string;
    loggerContext?: string;
    defaultValue?: unknown;
  } = {},
) {
  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (
      this: WithErrorHandlingCapable | Record<string, unknown>,
      ...args: unknown[]
    ): Promise<unknown> {
      const errorMessage = options.errorMessage || `выполнении метода ${propertyKey}`;

      // Проверяем, что объект наследует от BaseService
      if (
        this &&
        typeof this === 'object' &&
        'withErrorHandling' in this &&
        typeof this.withErrorHandling === 'function'
      ) {
        const serviceThis = this as WithErrorHandlingCapable;
        return serviceThis.withErrorHandling(
          errorMessage,
          async () => originalMethod.apply(this, args) as Promise<unknown>,
        );
      } else {
        // Fallback для объектов, не наследующих от BaseService
        try {
          return (await originalMethod.apply(this, args)) as unknown;
        } catch (error) {
          console.error(`Ошибка при ${errorMessage}:`, error);
          return options.defaultValue;
        }
      }
    };

    return descriptor;
  };
}
