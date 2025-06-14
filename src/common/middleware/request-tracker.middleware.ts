import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware для отслеживания HTTP запросов
 * Добавляет уникальный ID к каждому запросу и измеряет время выполнения
 */
@Injectable()
export class RequestTrackerMiddleware implements NestMiddleware {
  /**
   * Обрабатывает HTTP запрос, добавляя к нему метаданные для отслеживания
   */
  use(req: Request, res: Response, next: NextFunction) {
    // Добавляем уникальный ID запроса
    const requestId = uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Добавляем временную метку начала запроса
    const startTime = Date.now();
    req.headers['x-request-time'] = startTime.toString();

    // Обрабатываем завершение запроса для добавления информации о времени выполнения
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
    });

    next();
  }
}
