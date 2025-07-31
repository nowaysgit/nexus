import {
  ValidationRule,
  ValidationResult,
  ValidationError,
} from '../../common/interfaces/message-validation.interface';
import { MessageContext } from '../../common/interfaces/message-processor.interface';

// Расширим MessageContext для безопасного доступа к полям
type ExtendedMessageContext = MessageContext & Record<string, unknown>;

/**
 * Правило для проверки обязательных полей
 */
export class RequiredFieldsRule implements ValidationRule {
  readonly name = 'RequiredFieldsRule';

  constructor(private readonly requiredFields: string[]) {}

  async validate(message: MessageContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const extendedMessage = message as ExtendedMessageContext;

    for (const field of this.requiredFields) {
      const value = this.getNestedValue(extendedMessage, field);
      if (value === undefined || value === null || value === '') {
        errors.push({
          message: `Обязательное поле '${field}' отсутствует или пустое`,
          field,
          code: 'REQUIRED_FIELD_MISSING',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (
        acc &&
        typeof acc === 'object' &&
        acc !== null &&
        part in (acc as Record<string, unknown>)
      ) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }
}

/**
 * Правило для проверки типа сообщения
 */
export class MessageTypeRule implements ValidationRule {
  readonly name = 'MessageTypeRule';

  constructor(private readonly allowedTypes: string[]) {}

  async validate(message: MessageContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!this.allowedTypes.includes(message.type)) {
      errors.push({
        message: `Недопустимый тип сообщения: ${message.type}. Разрешены: ${this.allowedTypes.join(', ')}`,
        field: 'type',
        code: 'INVALID_MESSAGE_TYPE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Правило для проверки длины контента
 */
export class ContentLengthRule implements ValidationRule {
  readonly name = 'ContentLengthRule';

  constructor(
    private readonly maxLength: number,
    private readonly field: string = 'content',
  ) {}

  async validate(message: MessageContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const extendedMessage = message as ExtendedMessageContext;
    const content = this.getNestedValue(extendedMessage, this.field);

    if (content && typeof content === 'string' && content.length > this.maxLength) {
      errors.push({
        message: `Длина поля ${this.field} превышает максимально допустимую (${this.maxLength} символов)`,
        field: this.field,
        code: 'CONTENT_TOO_LONG',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (
        acc &&
        typeof acc === 'object' &&
        acc !== null &&
        part in (acc as Record<string, unknown>)
      ) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }
}

/**
 * Правило для проверки формата даты
 */
export class DateFormatRule implements ValidationRule {
  readonly name = 'DateFormatRule';

  constructor(private readonly field: string = 'createdAt') {}

  async validate(message: MessageContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const extendedMessage = message as ExtendedMessageContext;
    const date = this.getNestedValue(extendedMessage, this.field);

    if (date && typeof date === 'string' && !this.isValidDate(date)) {
      errors.push({
        message: `Поле ${this.field} должно быть в формате ISO 8601`,
        field: this.field,
        code: 'INVALID_DATE_FORMAT',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (
        acc &&
        typeof acc === 'object' &&
        acc !== null &&
        part in (acc as Record<string, unknown>)
      ) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  private isValidDate(date: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    return isoDateRegex.test(date) && !isNaN(Date.parse(date));
  }
}

export interface RegexRuleOptions {
  field: string;
  pattern: RegExp;
  errorMessage: string;
  invertMatch?: boolean;
}

/**
 * Правило для валидации поля с помощью регулярного выражения
 */
export class RegexRule implements ValidationRule {
  readonly name = 'RegexRule';

  constructor(private readonly options: RegexRuleOptions) {}

  async validate(message: MessageContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const extendedMessage = message as ExtendedMessageContext;
    const value = this.getNestedValue(extendedMessage, this.options.field);

    if (typeof value === 'string') {
      const matches = this.options.pattern.test(value);
      const shouldFail = this.options.invertMatch ? matches : !matches;

      if (shouldFail) {
        errors.push({
          message: this.options.errorMessage,
          field: this.options.field,
          code: 'REGEX_VALIDATION_FAILED',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (
        acc &&
        typeof acc === 'object' &&
        acc !== null &&
        part in (acc as Record<string, unknown>)
      ) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }
}
