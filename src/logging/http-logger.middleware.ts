import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LogService } from './log.service';

/**
 * Унифицированный middleware для логирования HTTP запросов
 * Заменяет HttpLoggerMiddleware и LoggingMiddleware
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logService: LogService) {
    this.logService.setContext('HttpLogger');
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Логируем информацию о входящем запросе
    this.logService.info(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || '-';
      const responseTime = Date.now() - startTime;

      const message = `${method} ${originalUrl} ${statusCode} ${responseTime}ms ${contentLength}`;
      const meta = {
        ip,
        userAgent,
        responseTime,
        contentLength,
      };

      if (statusCode >= 500) {
        this.logService.error(message, meta);
      } else if (statusCode >= 400) {
        this.logService.warn(message, meta);
      } else {
        this.logService.info(message, meta);
      }
    });

    next();
  }
}
