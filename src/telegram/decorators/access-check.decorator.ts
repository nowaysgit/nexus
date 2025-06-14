import { LogService } from '../../logging/log.service';
import { Context } from '../interfaces/context.interface';
import { withErrorHandling } from '../../common/utils/error-handling/error-handling.utils';

interface IAccessService {
  checkAccess(ctx: Context): Promise<boolean>;
}

interface IClassWithAccessService {
  accessService?: IAccessService;
}

/**
 * Декоратор для проверки доступа перед выполнением метода
 * Предполагается, что первым аргументом метода является контекст Telegraf
 * и класс содержит свойство accessService с методом checkAccess
 */
export function WithAccessCheck(
  options: {
    redirectOnFail?: boolean;
    loggerContext?: string;
  } = {},
) {
  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const logger = new LogService(null, null, null).setContext(
      options.loggerContext || 'AccessCheckDecorator',
    );

    descriptor.value = async function (
      this: IClassWithAccessService,
      ...args: unknown[]
    ): Promise<unknown> {
      return withErrorHandling(
        async () => {
          const ctx = args[0] as Context;

          if (!ctx) {
            logger.warn(`Не найден ctx в методе ${propertyKey}`);
            return originalMethod.apply(this, args) as unknown;
          }

          // Проверяем наличие accessService у экземпляра класса
          const accessService = this.accessService;
          if (!accessService || typeof accessService.checkAccess !== 'function') {
            logger.warn(
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
        },
        `проверке доступа перед выполнением ${propertyKey}`,
        logger,
        { method: propertyKey },
        undefined,
      );
    };

    return descriptor;
  };
}
