/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidationService } from '../services/validation.service';

/**
 * Глобальный пайп для валидации входящих данных с использованием DTO
 */
@Injectable()
export class GlobalValidationPipe implements PipeTransform<any> {
  constructor(private readonly validationService: ValidationService) {}

  async transform(value: unknown, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Санитизация входных данных
    if (typeof value === 'object' && value !== null) {
      // Рекурсивно санитизируем строковые поля в объекте
      value = this.sanitizeObjectFields(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      value = this.validationService.sanitizeInput(value);
    }

    // Валидация с помощью объединенного сервиса
    const result = await this.validationService.validate(
      metatype,
      value as Record<string, unknown>,
      {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      },
    );

    if (!result.isValid) {
      const errorMessage =
        result.errors?.map(e => `${e.field}: ${e.message}`).join(', ') || 'Validation failed';
      throw new BadRequestException(errorMessage);
    }

    return result.validatedData;
  }

  /**
   * Рекурсивно санитизирует строковые поля в объекте
   */
  private sanitizeObjectFields(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.validationService.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObjectFields(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
