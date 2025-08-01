import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validatePort } from './common/utils/port-validator.util';
import { createCorsConfig } from './common/utils/cors-validator.util';
import { GlobalExceptionFilter, LogService } from './logging';
import type { Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Создаем простой логгер
  const logger = app.get(LogService);

  // Используем глобальный фильтр исключений с логгером
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Настраиваем CORS с валидацией
  const corsConfig = createCorsConfig(process.env.CORS_ORIGIN);
  app.enableCors(corsConfig);

  // Добавляем простой health check endpoint
  app.getHttpAdapter().get('/health', (_req, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'nexus-api',
    });
  });

  const portEnv = process.env.PORT;
  if (!portEnv) {
    throw new Error('PORT environment variable is required');
  }
  const port = validatePort(portEnv);
  await app.listen(port);

  logger.log(`Приложение запущено на порту ${port}`);
}

void bootstrap();
