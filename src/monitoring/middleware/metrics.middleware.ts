import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../monitoring.service';
import { LogService } from '../../logging/log.service';

/**
 * Middleware для сбора метрик HTTP-запросов
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly logService: LogService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Время начала обработки запроса
    const startTime = Date.now();

    // Используем событие finish для отслеживания завершения ответа
    res.on('finish', () => {
      try {
        // Вычисляем длительность обработки запроса
        const duration = Date.now() - startTime;

        // Записываем метрики запроса
        this.monitoringService.recordMetric(
          `http_request_${req.method.toLowerCase()}`,
          duration,
          'ms',
          {
            method: req.method,
            status: res.statusCode.toString(),
            path: req.path,
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logService.error(`Ошибка при сборе метрик запроса: ${errorMessage}`, errorStack);
      }
    });

    next();
  }
}
