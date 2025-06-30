import { Injectable } from '@nestjs/common';
import { ValidationResult, ValidationError } from '../../common/interfaces/validation.interface';
import { MessageContext } from '../../common/interfaces/message-processor.interface';
import { LogService } from '../../logging/log.service';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface ValidationErrorHandlingOptions {
  /** Логировать ошибки валидации (по умолчанию true) */
  logErrors?: boolean;

  /** Генерировать исключения при ошибках валидации (по умолчанию false) */
  throwExceptions?: boolean;

  /** Уровень логирования для ошибок */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /** Дополнительная контекстная информация для логов */
  contextData?: Record<string, unknown>;
}

/**
 * Структурированный результат обработки ошибок валидации
 */
export interface ErrorHandlingResult {
  /** Успешна ли валидация */
  success: boolean;

  /** Отформатированное сообщение об ошибке (если есть ошибки) */
  errorMessage?: string;

  /** Список ошибок валидации */
  errors?: string[] | ValidationError[];

  /** Оригинальный результат валидации */
  validationResult: ValidationResult;

  /** Контекст сообщения */
  context: MessageContext;

  /** Дополнительные данные */
  metadata?: Record<string, unknown>;
}

/**
 * Тип ошибки валидации для определения специфической обработки
 */
export enum ValidationErrorType {
  /** Общая ошибка валидации */
  GENERAL = 'general',

  /** Ошибка формата данных */
  FORMAT = 'format',

  /** Ошибка API валидации */
  API = 'api',

  /** Ошибка валидации БД */
  DATABASE = 'database',

  /** Ошибка валидации сообщения */
  MESSAGE = 'message',

  /** Ошибка валидации пользовательского ввода */
  USER_INPUT = 'user_input',

  /** Ошибка валидации конфигурации */
  CONFIGURATION = 'configuration',
}

/**
 * Расширенная структура ошибки валидации с типом
 */
export interface ExtendedValidationError extends ValidationError {
  /** Тип ошибки валидации */
  type?: ValidationErrorType;

  /** Дополнительные данные об ошибке */
  details?: Record<string, unknown>;
}

/**
 * Сервис для централизованной обработки ошибок валидации сообщений
 * Предоставляет унифицированный механизм обработки и логирования ошибок
 */
@Injectable()
export class ValidationErrorHandlerService {
  constructor(private readonly logService: LogService) {
    this.logService.setContext('ValidationErrorHandlerService');
  }

  /**
   * Обрабатывает результат валидации и возвращает структурированный результат
   * @param result Результат валидации
   * @param context Контекст сообщения
   * @param source Источник сообщения (для логирования)
   * @param options Опции обработки ошибок
   * @returns Структурированный результат обработки ошибок
   */
  handleValidationResult(
    result: ValidationResult,
    context: MessageContext,
    source: string,
    options: ValidationErrorHandlingOptions = {},
  ): ErrorHandlingResult {
    const {
      logErrors = true,
      throwExceptions = false,
      logLevel = 'warn',
      contextData = {},
    } = options;

    // Подготовка базового объекта результата
    const handlingResult: ErrorHandlingResult = {
      success: result.isValid === true,
      validationResult: result,
      context,
      metadata: {
        source,
        ...contextData,
      },
    };

    // Если валидация успешна, просто возвращаем результат
    if (handlingResult.success) {
      return handlingResult;
    }

    // Обрабатываем ошибки валидации
    const errors = result.errors || [];
    handlingResult.errors = errors;

    const primaryError = errors[0];
    const errorMessage = this.formatErrorMessage(primaryError, source);
    handlingResult.errorMessage = errorMessage;

    // Логируем ошибки если включено логирование
    if (logErrors) {
      const logData = {
        messageId: context.id,
        messageType: context.type,
        source: context.source,
        errors,
        ...contextData,
      };

      switch (logLevel) {
        case 'debug':
          this.logService.debug(errorMessage, logData);
          break;
        case 'info':
          this.logService.log(errorMessage, logData);
          break;
        case 'warn':
          this.logService.warn(errorMessage, logData);
          break;
        case 'error':
          this.logService.error(errorMessage, logData);
          break;
      }
    }

    // Если настроено, генерируем исключение
    if (throwExceptions) {
      throw new Error(errorMessage);
    }

    // Возвращаем структурированный результат
    return handlingResult;
  }

  /**
   * Форматирует сообщение об ошибке валидации
   * @param error Ошибка валидации
   * @param source Источник сообщения
   * @returns Отформатированное сообщение об ошибке
   */
  private formatErrorMessage(error: ValidationError | string | undefined, source: string): string {
    if (!error) {
      return `Ошибка валидации сообщения из источника ${source}`;
    }

    if (typeof error === 'string') {
      return `Ошибка валидации: ${error} - источник: ${source}`;
    }

    let message = `Ошибка валидации: ${error.message}`;

    if (error.field) {
      message += ` (поле: ${error.field})`;
    }

    if (error.code) {
      message += ` [код: ${error.code}]`;
    }

    // Если это расширенная ошибка с типом, добавляем тип
    if ((error as ExtendedValidationError).type) {
      message += ` [тип: ${(error as ExtendedValidationError).type}]`;
    }

    if (source) {
      message += ` - источник: ${source}`;
    }

    return message;
  }

  /**
   * Обрабатывает ошибки валидации для нескольких результатов
   * @param results Массив результатов валидации
   * @param contexts Массив контекстов сообщений
   * @param source Источник сообщений
   * @param options Опции обработки ошибок
   * @returns Массив результатов обработки ошибок
   */
  handleBatchValidationResults(
    results: ValidationResult[],
    contexts: MessageContext[],
    source: string,
    options: ValidationErrorHandlingOptions = {},
  ): ErrorHandlingResult[] {
    const handlingResults: ErrorHandlingResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const context = contexts[i];

      const handlingResult = this.handleValidationResult(
        result,
        context,
        source,
        { ...options, throwExceptions: false }, // Отключаем исключения для пакетной обработки
      );

      handlingResults.push(handlingResult);
    }

    return handlingResults;
  }

  /**
   * Обрабатывает ошибку валидации
   * @param error Ошибка валидации
   * @returns Результат валидации с ошибкой
   */
  handleValidationError(error: unknown): ValidationResult {
    const errorMessage = getErrorMessage(error);
    this.logService.error('Ошибка валидации', { error: errorMessage });

    return {
      isValid: false,
      errors: [{ message: this.formatError(error), field: 'unknown' }],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Форматирует ошибку в строку
   * @param error Ошибка
   * @returns Отформатированная ошибка
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return JSON.stringify(error);
  }

  /**
   * Обрабатывает ошибки валидации API запросов
   * @param error Ошибка валидации API
   * @param source Источник ошибки
   * @param logLevel Уровень логирования
   * @returns Результат валидации с API ошибкой
   */
  handleApiValidationError(
    error: unknown,
    source = 'api',
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error',
  ): ValidationResult {
    const errorMessage = getErrorMessage(error);

    const logData = {
      error: errorMessage,
      source,
      type: ValidationErrorType.API,
    };

    switch (logLevel) {
      case 'debug':
        this.logService.debug('Ошибка валидации API', logData);
        break;
      case 'info':
        this.logService.log('Ошибка валидации API', logData);
        break;
      case 'warn':
        this.logService.warn('Ошибка валидации API', logData);
        break;
      case 'error':
        this.logService.error('Ошибка валидации API', logData);
        break;
    }

    return {
      isValid: false,
      errors: [
        {
          message: this.formatError(error),
          field: 'api',
          code: 'API_VALIDATION_ERROR',
          type: ValidationErrorType.API,
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Обрабатывает ошибки валидации формата данных
   * @param error Ошибка валидации формата
   * @param field Поле с ошибкой
   * @param source Источник ошибки
   * @returns Результат валидации с ошибкой формата
   */
  handleFormatValidationError(error: unknown, field = 'format', source = 'data'): ValidationResult {
    const errorMessage = getErrorMessage(error);

    this.logService.warn('Ошибка валидации формата данных', {
      error: errorMessage,
      field,
      source,
      type: ValidationErrorType.FORMAT,
    });

    return {
      isValid: false,
      errors: [
        {
          message: this.formatError(error),
          field,
          code: 'FORMAT_VALIDATION_ERROR',
          type: ValidationErrorType.FORMAT,
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Обрабатывает ошибки валидации в базе данных
   * @param error Ошибка валидации БД
   * @param entity Сущность с ошибкой
   * @returns Результат валидации с ошибкой БД
   */
  handleDatabaseValidationError(error: unknown, entity: string): ValidationResult {
    const errorMessage = getErrorMessage(error);

    this.logService.error('Ошибка валидации базы данных', {
      error: errorMessage,
      entity,
      type: ValidationErrorType.DATABASE,
    });

    return {
      isValid: false,
      errors: [
        {
          message: `Ошибка валидации в базе данных для ${entity}: ${this.formatError(error)}`,
          field: entity,
          code: 'DATABASE_VALIDATION_ERROR',
          type: ValidationErrorType.DATABASE,
          details: { entity },
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Обрабатывает ошибки валидации сообщений
   * @param error Ошибка валидации сообщения
   * @param messageId ID сообщения
   * @returns Результат валидации с ошибкой сообщения
   */
  handleMessageValidationError(error: unknown, messageId?: string): ValidationResult {
    const errorMessage = getErrorMessage(error);

    this.logService.warn('Ошибка валидации сообщения', {
      error: errorMessage,
      messageId,
      type: ValidationErrorType.MESSAGE,
    });

    return {
      isValid: false,
      errors: [
        {
          message: `Ошибка валидации сообщения: ${this.formatError(error)}`,
          field: 'message',
          code: 'MESSAGE_VALIDATION_ERROR',
          type: ValidationErrorType.MESSAGE,
          details: { messageId },
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Обрабатывает ошибки валидации пользовательского ввода
   * @param error Ошибка валидации пользовательского ввода
   * @param userId ID пользователя
   * @param inputType Тип пользовательского ввода
   * @returns Результат валидации с ошибкой пользовательского ввода
   */
  handleUserInputValidationError(
    error: unknown,
    userId?: string | number,
    inputType = 'unknown',
  ): ValidationResult {
    const errorMessage = getErrorMessage(error);

    this.logService.warn('Ошибка валидации пользовательского ввода', {
      error: errorMessage,
      userId,
      inputType,
      type: ValidationErrorType.USER_INPUT,
    });

    return {
      isValid: false,
      errors: [
        {
          message: `Ошибка валидации пользовательского ввода типа ${inputType}: ${this.formatError(error)}`,
          field: inputType,
          code: 'USER_INPUT_VALIDATION_ERROR',
          type: ValidationErrorType.USER_INPUT,
          details: { userId, inputType },
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Обрабатывает ошибки валидации конфигурации
   * @param error Ошибка валидации конфигурации
   * @param configKey Ключ конфигурации
   * @returns Результат валидации с ошибкой конфигурации
   */
  handleConfigValidationError(error: unknown, configKey?: string): ValidationResult {
    const errorMessage = getErrorMessage(error);

    this.logService.error('Ошибка валидации конфигурации', {
      error: errorMessage,
      configKey,
      type: ValidationErrorType.CONFIGURATION,
    });

    return {
      isValid: false,
      errors: [
        {
          message: `Ошибка валидации конфигурации ${configKey ? `(${configKey})` : ''}: ${this.formatError(error)}`,
          field: configKey || 'config',
          code: 'CONFIG_VALIDATION_ERROR',
          type: ValidationErrorType.CONFIGURATION,
          details: { configKey },
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }

  /**
   * Создает результат валидации с кастомной ошибкой
   * @param message Сообщение об ошибке
   * @param field Поле с ошибкой
   * @param code Код ошибки
   * @param type Тип ошибки
   * @param details Дополнительные детали
   * @returns Результат валидации с кастомной ошибкой
   */
  createCustomValidationError(
    message: string,
    field = 'unknown',
    code = 'CUSTOM_VALIDATION_ERROR',
    type = ValidationErrorType.GENERAL,
    details?: Record<string, unknown>,
  ): ValidationResult {
    this.logService.warn('Кастомная ошибка валидации', {
      message,
      field,
      code,
      type,
      details,
    });

    return {
      isValid: false,
      errors: [
        {
          message,
          field,
          code,
          type,
          details,
        } as ExtendedValidationError,
      ],
      validatedData: {} as Record<string, unknown>,
    };
  }
}
