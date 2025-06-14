import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ValidationService } from '../../validation/services/validation.service';
import { Request } from 'express';
import { ParsedQs } from 'qs';
import { ParamsDictionary } from 'express-serve-static-core';

/**
 * Интерцептор для автоматической санитизации входящих данных
 */
@Injectable()
export class SanitizeRequestInterceptor implements NestInterceptor {
  constructor(private readonly validationService: ValidationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(request.body);
    }

    if (request.query && typeof request.query === 'object') {
      request.query = this.sanitizeQueryObject(request.query);
    }

    if (request.params && typeof request.params === 'object') {
      request.params = this.sanitizeParamsObject(request.params);
    }

    return next.handle();
  }

  /**
   * Рекурсивно санитизирует строковые поля в объекте
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.validationService.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Санитизирует объект query с учетом типа ParsedQs
   */
  private sanitizeQueryObject(query: ParsedQs): ParsedQs {
    const result: ParsedQs = {};
    
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        result[key] = this.validationService.sanitizeInput(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'string' ? this.validationService.sanitizeInput(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeQueryObject(value as ParsedQs);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Санитизирует объект params с учетом типа ParamsDictionary
   */
  private sanitizeParamsObject(params: ParamsDictionary): ParamsDictionary {
    const result: ParamsDictionary = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        result[key] = this.validationService.sanitizeInput(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
}
