/**
 * Декоратор для автоматической обработки ошибок в методах
 * Теперь работает с BaseService
 */
export function WithErrorHandling(
  options: {
    errorMessage?: string;
    loggerContext?: string;
    defaultValue?: unknown;
  } = {},
) {
  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: any, ...args: unknown[]): Promise<unknown> {
      const errorMessage = options.errorMessage || `выполнении метода ${propertyKey}`;

      // Проверяем, что объект наследует от BaseService
      if (typeof this.withErrorHandling === 'function') {
        return this.withErrorHandling(
          errorMessage,
          async () => originalMethod.apply(this, args) as Promise<unknown>,
        );
      } else {
        // Fallback для объектов, не наследующих от BaseService
        try {
          return (await originalMethod.apply(this, args)) as Promise<unknown>;
        } catch (error) {
          console.error(`Ошибка при ${errorMessage}:`, error);
          return options.defaultValue;
        }
      }
    };

    return descriptor;
  };
}
