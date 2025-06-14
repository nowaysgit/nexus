import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * Интерфейс для настроек rate limiting
 */
export interface RateLimitOptions {
  /** Максимальное количество запросов */
  limit: number;
  /** Временное окно в секундах */
  windowMs: number;
  /** Сообщение об ошибке */
  message?: string;
  /** Ключ для группировки запросов (по умолчанию IP) */
  keyGenerator?: (req: Request) => string;
}

/**
 * Декоратор для настройки rate limiting
 */
export const RateLimit = (options: RateLimitOptions) => {
  return (target: unknown, propertyKey?: string) => {
    Reflect.defineMetadata('rate-limit', options, target, propertyKey);
  };
};

/**
 * Guard для защиты от брутфорс-атак с помощью rate limiting
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Получаем настройки rate limiting из метаданных
    const rateLimitOptions =
      this.reflector.get<RateLimitOptions>('rate-limit', context.getHandler()) ||
      this.reflector.get<RateLimitOptions>('rate-limit', context.getClass());

    if (!rateLimitOptions) {
      return true; // Если rate limiting не настроен, пропускаем
    }

    const key = rateLimitOptions.keyGenerator
      ? rateLimitOptions.keyGenerator(request)
      : this.getClientKey(request);

    const now = Date.now();
    const windowMs = rateLimitOptions.windowMs * 1000; // Конвертируем в миллисекунды

    // Получаем или создаем запись для данного ключа
    let record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // Создаем новую запись или сбрасываем старую
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.requestCounts.set(key, record);
      return true;
    }

    // Увеличиваем счетчик
    record.count++;

    if (record.count > rateLimitOptions.limit) {
      const message =
        rateLimitOptions.message ||
        `Too many requests. Limit: ${rateLimitOptions.limit} per ${rateLimitOptions.windowMs} seconds`;

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Генерирует ключ для идентификации клиента
   */
  private getClientKey(request: Request): string {
    // Пытаемся получить реальный IP через заголовки прокси
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown';

    // Добавляем User-Agent для более точной идентификации
    const userAgent = request.headers['user-agent'] || 'unknown';

    return `${ip}:${userAgent}`;
  }

  /**
   * Очищает устаревшие записи (можно вызывать периодически)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }
}
