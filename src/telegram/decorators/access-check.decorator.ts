import { Context } from '../interfaces/context.interface';

interface IAccessService {
  checkAccess(ctx: Context): Promise<boolean>;
}

interface IClassWithAccessService {
  accessService?: IAccessService;
  withErrorHandling?: (operation: string, fn: () => Promise<unknown>) => Promise<unknown>;
  logService?: { warn: (message: string) => void };
}

/**
 * Декоратор для проверки доступа перед выполнением метода
 * Предполагается, что первым аргументом метода является контекст Telegraf
 * и класс содержит свойство accessService с методом checkAccess
 * Теперь работает с BaseService
 */
export function WithAccessCheck(
  options: {
    redirectOnFail?: boolean;
    loggerContext?: string;
  } = {},
) {
  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (
      this: IClassWithAccessService,
      ...args: unknown[]
    ): Promise<unknown> {
      const errorHandler = async () => {
        const ctx = args[0] as Context;

        if (!ctx) {
          this.logService?.warn(`Не найден ctx в методе ${propertyKey}`);
          return originalMethod.apply(this, args) as unknown;
        }

        // Проверяем наличие accessService у экземпляра класса
        const accessService = this.accessService;
        if (!accessService || typeof accessService.checkAccess !== 'function') {
          this.logService?.warn(
            `Не найден accessService в классе для метода ${propertyKey}, пропускаем проверку доступа`,
          );
          return originalMethod.apply(this, args) as unknown;
        }

        const hasAccess = await accessService.checkAccess(ctx);

        if (!hasAccess) {
          if (options.redirectOnFail) {
            await ctx.reply(
              'У вас нет доступа к этой функции. Пожалуйста, введите ключ доступа с помощью команды /access [ключ]',
            );
          }
          return undefined;
        }

        return originalMethod.apply(this, args) as unknown;
      };

      // Проверяем, что объект наследует от BaseService
      if (typeof this.withErrorHandling === 'function') {
        return this.withErrorHandling(
          `проверке доступа перед выполнением ${propertyKey}`,
          errorHandler,
        );
      } else {
        // Fallback для объектов, не наследующих от BaseService
        try {
          return await errorHandler();
        } catch (error) {
          console.error(`Ошибка при проверке доступа для ${propertyKey}:`, error);
          return undefined;
        }
      }
    };

    return descriptor;
  };
}
