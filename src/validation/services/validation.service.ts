import { Injectable, Type, BadRequestException } from '@nestjs/common';
import {
  validate,
  ValidatorOptions,
  ValidationError as ClassValidatorError,
} from 'class-validator';
import { plainToClass, ClassTransformOptions } from 'class-transformer';
import {
  IValidationService,
  ValidationResult,
  ValidationError,
  ValidationOptions,
} from '../../common/interfaces/validation.interface';
import { LogService } from '../../logging/log.service';
import { ValidationErrorHandlerService } from './validation-error-handler.service';
import { getErrorMessage } from '../../common/utils/error.utils';

/**
 * Сервис валидации DTO объектов
 * Упрощенная версия - только DTO валидация, message валидация удалена
 */
@Injectable()
export class ValidationService implements IValidationService {
  protected readonly serviceName: string = 'ValidationService';

  constructor(
    private readonly logService: LogService,
    private readonly errorHandlerService: ValidationErrorHandlerService,
  ) {
    this.logService.setContext(this.serviceName);
  }

  /**
   * Валидирует объект по классу DTO
   */
  async validate(
    dtoClass: Type<unknown>,
    value: Record<string, unknown>,
    options?: ValidationOptions,
  ): Promise<ValidationResult> {
    try {
      if (this.isDtoClass(dtoClass)) {
        return await this.validateDto(dtoClass, value, options);
      }
      return await this.validateInternal(dtoClass, value, options);
    } catch (error: unknown) {
      this.logService.error(`Ошибка валидации: ${getErrorMessage(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Внутренняя ошибка валидации: ${getErrorMessage(error)}`,
            code: 'VALIDATION_ERROR',
          },
        ],
        validatedData: value,
      };
    }
  }

  /**
   * Валидирует объект по классу DTO с использованием class-validator
   */
  private async validateDto(
    dtoClass: Type<unknown>,
    value: Record<string, unknown>,
    options?: ValidationOptions,
  ): Promise<ValidationResult> {
    const transformOptions: ClassTransformOptions = {
      enableImplicitConversion: options?.transform ?? true,
      excludeExtraneousValues: options?.whitelist ?? false,
      exposeUnsetFields: !options?.skipUndefinedProperties,
    };

    const transformedObject = plainToClass(dtoClass, value, transformOptions);

    const validatorOptions: ValidatorOptions = {
      whitelist: options?.whitelist ?? true,
      forbidNonWhitelisted: options?.forbidNonWhitelisted ?? false,
      skipNullProperties: options?.skipNullProperties ?? false,
      skipUndefinedProperties: options?.skipUndefinedProperties ?? false,
      skipMissingProperties: false,
    };

    const validationErrors = await validate(transformedObject as object, validatorOptions);

    if (validationErrors.length > 0) {
      const errors = this.formatValidationErrors(validationErrors);
      return {
        isValid: false,
        errors,
        validatedData: value,
      };
    }

    return {
      isValid: true,
      validatedData: transformedObject,
    };
  }

  /**
   * Валидирует массив объектов
   */
  async validateMany(
    dtoClass: Type<unknown>,
    values: Array<Record<string, unknown>>,
    options?: ValidationOptions,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    for (const value of values) {
      const result = await this.validate(dtoClass, value, options);
      results.push(result);
    }
    return results;
  }

  /**
   * Валидирует сообщение пользователя
   */
  async validateMessage(message: string): Promise<{
    isValid: boolean;
    sanitizedMessage?: string;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // Базовая проверка сообщения
      if (!message || message.trim() === '') {
        return {
          isValid: false,
          errors: ['Сообщение не может быть пустым'],
          sanitizedMessage: '',
        };
      }

      // Очистка сообщения от потенциально опасного контента
      const sanitizedMessage = this.sanitizeInput(message);

      // Проверка на запрещенный контент (пример)
      if (sanitizedMessage.includes('<script>')) {
        return {
          isValid: false,
          errors: ['Message contains prohibited content'],
          sanitizedMessage: '',
        };
      }

      return {
        isValid: true,
        sanitizedMessage,
        warnings: [],
      };
    } catch (error) {
      this.logService.error(`Ошибка валидации сообщения: ${getErrorMessage(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Валидирует данные персонажа
   */
  async validateCharacterData(characterData: Record<string, unknown>): Promise<ValidationResult> {
    try {
      // Базовая проверка обязательных полей
      const requiredFields = ['name', 'personality'];
      const missingFields = requiredFields.filter(field => !characterData[field]);

      if (missingFields.length > 0) {
        return {
          isValid: false,
          errors: missingFields.map(field => ({
            field,
            message: `Поле ${field} обязательно`,
            code: 'REQUIRED_FIELD',
          })),
          validatedData: characterData,
        };
      }

      // Проверка типа и ограничений
      if (typeof characterData.name !== 'string' || characterData.name.length > 50) {
        return {
          isValid: false,
          errors: [
            {
              field: 'name',
              message: 'Имя должно быть строкой длиной не более 50 символов',
              code: 'INVALID_FORMAT',
            },
          ],
          validatedData: characterData,
        };
      }

      if (
        characterData.age &&
        (typeof characterData.age !== 'number' || characterData.age < 18 || characterData.age > 100)
      ) {
        return {
          isValid: false,
          errors: [
            {
              field: 'age',
              message: 'Возраст должен быть числом от 18 до 100',
              code: 'INVALID_FORMAT',
            },
          ],
          validatedData: characterData,
        };
      }

      return {
        isValid: true,
        validatedData: characterData,
      };
    } catch (error) {
      this.logService.error(`Ошибка валидации данных персонажа: ${getErrorMessage(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Внутренняя ошибка валидации: ${getErrorMessage(error)}`,
            code: 'VALIDATION_ERROR',
          },
        ],
        validatedData: characterData,
      };
    }
  }

  /**
   * Валидирует пользовательский ввод
   */
  async validateUserInput(input: Record<string, unknown>): Promise<ValidationResult> {
    try {
      // Пример базовой валидации
      const sanitizedInput = Object.entries(input).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = this.sanitizeInput(value);
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );

      return {
        isValid: true,
        validatedData: sanitizedInput,
      };
    } catch (error) {
      this.logService.error(`Ошибка валидации пользовательского ввода: ${getErrorMessage(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Внутренняя ошибка валидации: ${getErrorMessage(error)}`,
            code: 'VALIDATION_ERROR',
          },
        ],
        validatedData: input,
      };
    }
  }

  /**
   * Очищает пользовательский ввод от потенциально опасных элементов
   */
  sanitizeInput(input: string): string {
    // Пример простой санитизации для удаления HTML тегов
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<\/?[^>]+(>|$)/g, '');
    return sanitized;
  }

  /**
   * Валидирует API запрос
   */
  async validateApiRequest(request: Record<string, unknown>): Promise<{
    isValid: boolean;
    validatedRequest?: Record<string, unknown>;
    errors?: ValidationError[];
  }> {
    try {
      // Проверка обязательных полей
      const requiredFields = ['method', 'path'];
      const missingFields = requiredFields.filter(field => !request[field]);

      if (missingFields.length > 0) {
        return {
          isValid: false,
          errors: missingFields.map(field => ({
            field,
            message: `Поле ${field} обязательно`,
            code: 'REQUIRED_FIELD',
          })),
        };
      }

      // Проверка метода
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (
        typeof request.method === 'string' &&
        !validMethods.includes(request.method.toUpperCase())
      ) {
        return {
          isValid: false,
          errors: [
            {
              field: 'method',
              message: `Метод должен быть одним из: ${validMethods.join(', ')}`,
              code: 'INVALID_METHOD',
            },
          ],
        };
      }

      // Санитизация тела запроса, если оно есть
      const validatedRequest = { ...request };
      if (request.body && typeof request.body === 'object') {
        // Рекурсивная санитизация строковых полей
        const sanitizeObject = (obj: Record<string, unknown>): Record<string, unknown> => {
          return Object.entries(obj).reduce(
            (acc, [key, value]) => {
              if (typeof value === 'string') {
                acc[key] = this.sanitizeInput(value);
              } else if (typeof value === 'object' && value !== null) {
                acc[key] = sanitizeObject(value as Record<string, unknown>);
              } else {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, unknown>,
          );
        };

        validatedRequest.body = sanitizeObject(request.body as Record<string, unknown>);
      }

      return {
        isValid: true,
        validatedRequest,
      };
    } catch (error) {
      this.logService.error(`Ошибка валидации API запроса: ${getErrorMessage(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Внутренняя ошибка валидации: ${getErrorMessage(error)}`,
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Валидирует конфигурационные настройки
   */
  async validateConfiguration(config: Record<string, unknown>): Promise<{
    isValid: boolean;
    validatedConfig?: Record<string, unknown>;
    errors?: ValidationError[];
    warnings?: string[];
  }> {
    try {
      const validatedConfig = { ...config };
      const warnings: string[] = [];

      // Проверка значений (пример)
      if (typeof config.apiTimeout === 'number' && config.apiTimeout > 10000) {
        warnings.push('API timeout is high');
      }

      if (typeof config.maxUsers === 'number' && config.maxUsers > 10000) {
        warnings.push('Maximum users count is very high');
      }

      return {
        isValid: true,
        validatedConfig,
        warnings,
      };
    } catch (error) {
      this.logService.error(`Ошибка валидации конфигурации: ${getErrorMessage(error)}`, {
        stack: error.stack,
      });
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Внутренняя ошибка валидации: ${getErrorMessage(error)}`,
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Возвращает правила валидации
   */
  getValidationRules(): Record<string, unknown> {
    return {
      message: {
        maxLength: 1000,
        allowedTags: [],
        prohibitedWords: ['spam', 'abuse'],
      },
      character: {
        nameMaxLength: 50,
        ageRange: [18, 100],
        requiredFields: ['name', 'personality'],
      },
    };
  }

  /**
   * Валидирует значение с помощью функции валидации
   */
  async validateWithFn(
    validationFn: (
      value: Record<string, unknown>,
    ) => boolean | string | Error | Promise<boolean | string | Error>,
    value: Record<string, unknown>,
  ): Promise<ValidationResult> {
    try {
      const validationResult = await validationFn(value);

      if (validationResult === true) {
        return {
          isValid: true,
          validatedData: value,
        };
      }

      if (typeof validationResult === 'string') {
        return {
          isValid: false,
          errors: [
            {
              field: 'value',
              message: validationResult,
              code: 'CUSTOM_VALIDATION_ERROR',
              value,
            },
          ],
          validatedData: value,
        };
      }

      if (validationResult instanceof Error) {
        return {
          isValid: false,
          errors: [
            {
              field: 'value',
              message: validationResult.message,
              code: 'CUSTOM_VALIDATION_ERROR',
              value,
            },
          ],
          validatedData: value,
        };
      }

      return {
        isValid: false,
        errors: [
          {
            field: 'value',
            message: 'Validation failed',
            code: 'CUSTOM_VALIDATION_ERROR',
            value,
          },
        ],
        validatedData: value,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logService.error(
        `Ошибка при выполнении пользовательской функции валидации: ${errorMessage}`,
        { stack: errorStack },
      );
      return {
        isValid: false,
        errors: [
          {
            field: 'global',
            message: `Ошибка при валидации: ${errorMessage}`,
            code: 'VALIDATION_FUNCTION_ERROR',
          },
        ],
        validatedData: value,
      };
    }
  }

  /**
   * Валидирует запрос и возвращает типизированный объект
   */
  async validateRequest<T>(
    dtoClass: Type<T>,
    requestData: Record<string, unknown>,
    options?: ValidationOptions,
  ): Promise<T> {
    const result = await this.validate(dtoClass, requestData, options);

    if (!result.isValid) {
      const errorMessage =
        result.errors?.map(e => `${e.field}: ${e.message}`).join(', ') || 'Validation failed';
      throw new BadRequestException(errorMessage);
    }

    return result.validatedData as T;
  }

  /**
   * Проверяет, является ли переданный объект классом DTO
   */
  private isDtoClass(obj: unknown): boolean {
    return typeof obj === 'function' && obj.prototype && obj.prototype.constructor === obj;
  }

  /**
   * Преобразует ошибки class-validator в унифицированный формат
   */
  private formatValidationErrors(
    errors: ClassValidatorError[],
    parentField: string = '',
  ): ValidationError[] {
    const formattedErrors: ValidationError[] = [];

    for (const error of errors) {
      const fieldName = parentField ? `${parentField}.${error.property}` : error.property;

      if (error.constraints) {
        for (const [constraintKey, message] of Object.entries(error.constraints)) {
          formattedErrors.push({
            field: fieldName,
            message,
            code: constraintKey.toUpperCase(),
            value: error.value as Record<string, unknown>,
          });
        }
      }

      if (error.children && error.children.length > 0) {
        const childErrors = this.formatValidationErrors(error.children, fieldName);
        formattedErrors.push(...childErrors);
      }
    }

    return formattedErrors;
  }

  /**
   * Внутренняя валидация для общих случаев
   */
  protected async validateInternal(
    _schema: unknown,
    value: Record<string, unknown>,
    _options?: ValidationOptions,
  ): Promise<ValidationResult> {
    return {
      isValid: true,
      validatedData: value,
    };
  }
}
