import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../../logging/log.service';
import { SessionData } from '../../../telegram/interfaces/context.interface';

// ErrorType импортирован из common/interfaces/error-handler.interface.ts для избежания дублирования

/**
 * Интерфейс для передачи результата проверки безопасной операции
 */
export interface SafeOperationResult {
  allowed: boolean;
  reason?: string;
  requireConfirmation?: boolean;
}

/**
 * Унифицированный сервис для централизованной обработки ошибок и утилит
 * Объединяет функциональность error-handling.service.ts и error-handling.utils.ts
 */
@Injectable()
export class ErrorHandlingService {
  // Конфигурация безопасных операций
  private readonly isProduction: boolean;
  private readonly allowUnsafe: boolean;
  private readonly forbiddenOperations: string[];
  private readonly operationsRequiringConfirmation: string[];

  constructor(
    private readonly logService: LogService,
    private readonly configService: ConfigService,
  ) {
    this.logService.setContext(ErrorHandlingService.name);

    // Инициализация конфигурации безопасных операций с безопасной типизацией
    this.isProduction = false;
    this.allowUnsafe = false;
    this.forbiddenOperations = ['dropSchema', 'truncateAllTables', 'deleteAllData'];
    this.operationsRequiringConfirmation = [
      'clearDatabase',
      'deleteAllUsers',
      'resetCharacters',
      'bulkDelete',
    ];

    try {
      const environment = this.configService.get<{ isProduction?: boolean }>('environment');
      if (
        environment &&
        typeof environment === 'object' &&
        environment !== null &&
        'isProduction' in environment
      ) {
        this.isProduction =
          typeof environment.isProduction === 'boolean' ? environment.isProduction : false;
      }

      const dbConfig = this.configService.get<{ allowUnsafe?: boolean }>('database');
      if (
        dbConfig &&
        typeof dbConfig === 'object' &&
        dbConfig !== null &&
        'allowUnsafe' in dbConfig
      ) {
        this.allowUnsafe = typeof dbConfig.allowUnsafe === 'boolean' ? dbConfig.allowUnsafe : false;
      }
    } catch {
      // Используем значения по умолчанию при ошибке конфигурации
    }

    this.logService.debug('Сервис обработки ошибок инициализирован', {
      isProduction: this.isProduction,
      allowUnsafe: this.allowUnsafe,
      forbiddenOperations: this.forbiddenOperations,
      operationsRequiringConfirmation: this.operationsRequiringConfirmation,
    });
  }

  // ===== ОСНОВНЫЕ МЕТОДЫ ОБРАБОТКИ ОШИБОК =====

  /**
   * Проверяет является ли логгер экземпляром LogService
   */
  private static isLogService(logger: Logger | LogService): logger is LogService {
    return 'info' in logger && 'warn' in logger && 'debug' in logger;
  }

  /**
   * Проверяет является ли логгер экземпляром LogService (экземплярный метод)
   */
  private isLogService(logger: Logger | LogService): logger is LogService {
    return ErrorHandlingService.isLogService(logger);
  }

  /**
   * Логирует ошибку с помощью предоставленного логгера
   */
  logError(
    logger: Logger | LogService,
    operation: string,
    error: unknown,
    meta?: Record<string, unknown>,
  ): void {
    if (ErrorHandlingService.isLogService(logger)) {
      // LogService поддерживает мета-данные
      logger.error(`Ошибка при ${operation}: ${this.formatErrorMessage(error)}`, {
        operation,
        context: 'ErrorHandlingService',
        ...meta,
      });
    } else {
      // Стандартный Logger
      logger.error(
        `Ошибка при ${operation}: ${error instanceof Error ? error.message : this.formatErrorMessage(error)}`,
      );
    }
  }

  /**
   * Безопасно форматирует сообщение ошибки
   */
  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return '[Object object]';
      }
    }

    // Для всех других типов используем безопасное преобразование
    return error instanceof Error ? error.message : JSON.stringify(error);
  }

  /**
   * Оборачивает асинхронную операцию, обрабатывая возможные ошибки
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    logger: Logger | LogService,
    meta?: Record<string, unknown>,
    defaultValue?: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logError(logger, errorMessage, error, meta);
      if (defaultValue !== undefined) return defaultValue;
      throw error;
    }
  }

  /**
   * Обрабатывает ошибку "не найдено", возвращая null или выбрасывая исключение
   */
  handleNotFound<T>(
    item: T | null | undefined,
    entityName: string,
    id: string | number,
    logger: Logger | LogService,
    throwError: boolean = true,
  ): T | null {
    if (!item) {
      const errorMessage = `${entityName} с ID ${id} не найден`;
      if (throwError) {
        if (ErrorHandlingService.isLogService(logger)) {
          logger.error(errorMessage, { entityName, id });
        } else {
          logger.error(errorMessage);
        }
        throw new Error(errorMessage);
      }
      return null;
    }
    return item;
  }

  /**
   * Проверяет доступность сервиса и логирует предупреждение, если сервис не доступен
   */
  requireService<T>(
    service: T | null | undefined,
    serviceName: string,
    logger: Logger | LogService,
  ): T | null {
    if (!service) {
      if (ErrorHandlingService.isLogService(logger)) {
        logger.warn(`Сервис ${serviceName} не доступен`);
      } else {
        logger.warn(`Сервис ${serviceName} не доступен`);
      }
      return null;
    }
    return service;
  }

  /**
   * Безопасно получает данные из callback-запроса Telegraf
   */
  getCallbackData(callbackQuery: unknown): string {
    if (!callbackQuery) return '';

    if (typeof callbackQuery === 'object' && callbackQuery !== null && 'data' in callbackQuery) {
      const data = (callbackQuery as Record<string, unknown>).data;
      return typeof data === 'string' ? data : '';
    }

    return '';
  }

  /**
   * Проверяет, является ли объект валидной сессией
   */
  isSessionValid(session: unknown): session is SessionData {
    return !!session && typeof session === 'object' && 'state' in session;
  }

  /**
   * Безопасно получает сессию из контекста
   */
  getSession(ctx: unknown): SessionData | null {
    if (
      ctx &&
      typeof ctx === 'object' &&
      'session' in ctx &&
      this.isSessionValid((ctx as Record<string, unknown>).session)
    ) {
      return (ctx as { session: SessionData }).session;
    }
    return null;
  }

  /**
   * Измеряет время выполнения операции и логирует его
   */
  async measureExecutionTime<T>(
    operation: () => Promise<T>,
    operationName: string,
    logger: Logger | LogService,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;

      if (ErrorHandlingService.isLogService(logger)) {
        logger.log(`Операция ${operationName} выполнена за ${executionTime}ms`, {
          operationName,
          executionTime,
        });
      } else {
        logger.log(`Операция ${operationName} выполнена за ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (ErrorHandlingService.isLogService(logger)) {
        logger.error(`Операция ${operationName} завершилась ошибкой за ${executionTime}ms`, {
          operationName,
          executionTime,
          error: error instanceof Error ? error.message : this.formatErrorMessage(error),
        });
      } else {
        logger.error(
          `Операция ${operationName} завершилась ошибкой за ${executionTime}ms: ${
            error instanceof Error ? error.message : this.formatErrorMessage(error)
          }`,
        );
      }

      throw error;
    }
  }

  /**
   * Форматирует ошибку в читаемый объект
   */
  formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (typeof error === 'object' && error !== null) {
      return error as Record<string, unknown>;
    }

    // Для всех других примитивов
    if (typeof error === 'number') {
      return { message: error.toString() };
    }

    if (typeof error === 'boolean') {
      return { message: error.toString() };
    }

    if (typeof error === 'symbol') {
      return { message: error.toString() };
    }

    if (error === null) {
      return { message: 'null' };
    }

    if (error === undefined) {
      return { message: 'undefined' };
    }

    // Для всех остальных случаев
    return { message: 'Unknown error' };
  }

  /**
   * Преобразует любую ошибку в HttpException
   */
  toHttpException(
    error: unknown,
    defaultMessage: string = 'Внутренняя ошибка сервера',
    defaultStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof Error) {
      return new HttpException(error.message, defaultStatus);
    }

    return new HttpException(defaultMessage, defaultStatus);
  }

  /**
   * Обрабатывает ошибки базы данных с подробным логированием
   */
  handleDbError(
    error: unknown,
    operation: string,
    logger: Logger | LogService,
    meta?: Record<string, unknown>,
  ): never {
    const errorInfo = this.formatError(error);
    const errorMessage = `Ошибка БД при выполнении ${operation}`;

    if (ErrorHandlingService.isLogService(logger)) {
      logger.error(errorMessage, { ...errorInfo, operation, ...meta });
    } else {
      logger.error(`${errorMessage}: ${this.formatErrorMessage(error)}`);
    }

    throw new InternalServerErrorException(errorMessage);
  }

  /**
   * Обрабатывает специфичные ошибки TypeORM
   */
  handleTypeORMError(
    error: unknown,
    logger: Logger | LogService,
    context?: Record<string, unknown>,
  ): HttpException {
    const errorInfo = this.formatError(error);

    if (ErrorHandlingService.isLogService(logger)) {
      logger.error('TypeORM ошибка', { ...errorInfo, ...context });
    } else {
      logger.error(`TypeORM ошибка: ${this.formatErrorMessage(error)}`);
    }

    // Определяем тип ошибки TypeORM
    if (error instanceof Error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        return new BadRequestException('Запись с такими данными уже существует');
      }

      if (error.message.includes('foreign key constraint')) {
        return new BadRequestException('Нарушение целостности данных');
      }

      if (error.message.includes('not found')) {
        return new NotFoundException('Запись не найдена');
      }
    }

    return new InternalServerErrorException('Ошибка базы данных');
  }

  /**
   * Обрабатывает детализированные ошибки валидации
   */
  handleValidationError(
    error: unknown,
    logger: Logger | LogService,
    context?: Record<string, unknown>,
  ): HttpException {
    const errorInfo = this.formatError(error);

    if (ErrorHandlingService.isLogService(logger)) {
      logger.error('Ошибка валидации', { ...errorInfo, ...context });
    } else {
      logger.error(`Ошибка валидации: ${this.formatErrorMessage(error)}`);
    }

    // Попытка извлечь детали валидации
    if (error instanceof Error && 'constraints' in error) {
      const errorWithConstraints = error as Error & { constraints: unknown };
      const constraints = errorWithConstraints.constraints;
      if (typeof constraints === 'object' && constraints !== null) {
        const constraintValues = Object.values(constraints as Record<string, unknown>);
        const messages = constraintValues
          .map(val => (typeof val === 'string' ? val : JSON.stringify(val)))
          .join(', ');
        return new BadRequestException(`Ошибка валидации: ${messages}`);
      }
    }

    return new BadRequestException(errorInfo.message || 'Ошибка валидации данных');
  }

  // ===== МЕТОДЫ БЕЗОПАСНЫХ ОПЕРАЦИЙ =====

  /**
   * Проверяет безопасность операции
   */
  checkOperation(operationName: string, confirmation = false): SafeOperationResult {
    // В продукшн режиме все небезопасные операции запрещены
    if (this.isProduction && !this.allowUnsafe) {
      if (this.forbiddenOperations.includes(operationName)) {
        return {
          allowed: false,
          reason: `Операция ${operationName} запрещена в продакшн режиме`,
        };
      }

      if (this.operationsRequiringConfirmation.includes(operationName)) {
        return {
          allowed: false,
          reason: `Операция ${operationName} требует специального разрешения в продакшн режиме`,
        };
      }
    }

    // Проверяем запрещенные операции
    if (this.forbiddenOperations.includes(operationName)) {
      return {
        allowed: false,
        reason: `Операция ${operationName} находится в списке запрещенных`,
      };
    }

    // Проверяем операции, требующие подтверждения
    if (this.operationsRequiringConfirmation.includes(operationName)) {
      if (!confirmation) {
        return {
          allowed: false,
          reason: `Операция ${operationName} требует подтверждения`,
          requireConfirmation: true,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Выполняет операцию с проверкой безопасности
   */
  async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    confirmation = false,
  ): Promise<T | null> {
    const checkResult = this.checkOperation(operationName, confirmation);

    if (!checkResult.allowed) {
      this.logService.warn(`Операция ${operationName} отклонена: ${checkResult.reason}`);
      return null;
    }

    try {
      const result = await operation();
      this.logService.log(`Операция ${operationName} выполнена успешно`);
      return result;
    } catch (error) {
      this.logService.error(
        `Ошибка при выполнении операции ${operationName}`,
        this.formatErrorMessage(error),
      );
      throw error;
    }
  }

  // ===== УТИЛИТАРНЫЕ МЕТОДЫ ДЛЯ ТИПОВ =====

  /**
   * Проверяет наличие свойства в объекте
   */
  hasProp<K extends string>(obj: unknown, prop: K): obj is { [key in K]: unknown } {
    return typeof obj === 'object' && obj !== null && prop in obj;
  }

  /**
   * Проверяет наличие свойства определенного типа в объекте
   */
  hasPropOfType<K extends string, T>(
    obj: unknown,
    prop: K,
    typePredicate: (value: unknown) => value is T,
  ): obj is { [key in K]: T } {
    return this.hasProp(obj, prop) && typePredicate((obj as { [key in K]: unknown })[prop]);
  }

  /**
   * Проверяет, является ли значение строкой
   */
  isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * Проверяет, является ли значение числом
   */
  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  /**
   * Проверяет, является ли значение логическим типом
   */
  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  /**
   * Проверяет, является ли значение объектом
   */
  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Проверяет, является ли значение массивом с типизированными элементами
   */
  isArray<T>(value: unknown, itemPredicate?: (item: unknown) => item is T): value is T[] {
    if (!Array.isArray(value)) return false;
    if (!itemPredicate) return true;
    return value.every(itemPredicate);
  }

  /**
   * Создает декоратор для обработки ошибок контроллера
   */
  HandleControllerErrors(options: {
    defaultMessage?: string;
    defaultStatus?: HttpStatus;
    logError?: boolean;
  }) {
    return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

      descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
        try {
          const result = originalMethod.apply(this, args) as Promise<unknown>;
          // Если результат - Promise, ждем его выполнения
          return result instanceof Promise ? await result : result;
        } catch (error) {
          if (options.logError !== false && this && typeof this === 'object' && 'logger' in this) {
            const logger = this.logger as Logger;
            logger.error(
              `Ошибка в ${target?.constructor?.name || 'контроллере'}.${propertyKey}`,
              error instanceof Error ? error.stack : String(error),
            );
          }

          if (this && typeof this === 'object' && 'toHttpException' in this) {
            const toHttpException = this.toHttpException as (
              error: unknown,
              message?: string,
              status?: HttpStatus,
            ) => HttpException;
            throw toHttpException.call(this, error, options.defaultMessage, options.defaultStatus);
          }

          throw error;
        }
      };

      return descriptor;
    };
  }

  // ===== СТАТИЧЕСКИЕ ФУНКЦИИ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ =====

  /**
   * Статическая версия withErrorHandling для использования без DI
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    logger: Logger | LogService,
    meta?: Record<string, unknown>,
    defaultValue?: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (ErrorHandlingService.isLogService(logger)) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : `Ошибка при ${errorMessage}: ${JSON.stringify(error)}`;
        logger.error(errorMsg, meta);
      } else {
        logger.error(
          `Ошибка при ${errorMessage}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
      }
      if (defaultValue !== undefined) return defaultValue;
      throw error;
    }
  }

  /**
   * Статическая версия logError для использования без DI
   */
  static logError(
    logger: Logger | LogService,
    operation: string,
    error: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const formatErrorMessage = (error: unknown): string => {
      if (error instanceof Error) {
        return error.message;
      }

      if (typeof error === 'string') {
        return error;
      }

      if (typeof error === 'object' && error !== null) {
        try {
          return JSON.stringify(error);
        } catch {
          return '[Object object]';
        }
      }

      return error instanceof Error ? error.message : JSON.stringify(error);
    };

    if (ErrorHandlingService.isLogService(logger)) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : `Ошибка при ${operation}: ${formatErrorMessage(error)}`;
      logger.error(errorMsg, meta);
    } else {
      logger.error(
        `Ошибка при ${operation}: ${error instanceof Error ? error.message : formatErrorMessage(error)}`,
      );
    }
  }

  /**
   * Статическая версия measureExecutionTime для использования без DI
   */
  static async measureExecutionTime<T>(
    operation: () => Promise<T>,
    operationName: string,
    logger: Logger | LogService,
  ): Promise<T> {
    const formatErrorMessage = (error: unknown): string => {
      if (error instanceof Error) {
        return error.message;
      }

      if (typeof error === 'string') {
        return error;
      }

      if (typeof error === 'object' && error !== null) {
        try {
          return JSON.stringify(error);
        } catch {
          return '[Object object]';
        }
      }

      return error instanceof Error ? error.message : JSON.stringify(error);
    };

    const startTime = Date.now();

    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;

      if (ErrorHandlingService.isLogService(logger)) {
        logger.log(`Операция ${operationName} выполнена за ${executionTime}ms`, {
          operationName,
          executionTime,
        });
      } else {
        logger.log(`Операция ${operationName} выполнена за ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (ErrorHandlingService.isLogService(logger)) {
        logger.error(`Ошибка при выполнении операции ${operationName}`, {
          executionTime: `${executionTime.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : formatErrorMessage(error),
        });
      } else {
        logger.error(
          `Ошибка при выполнении операции ${operationName} за ${executionTime.toFixed(2)}ms: ${error instanceof Error ? error.message : formatErrorMessage(error)}`,
        );
      }

      throw error;
    }
  }
}
