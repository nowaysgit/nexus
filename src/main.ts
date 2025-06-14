import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validatePort } from './common/utils/port-validator.util';
import { createCorsConfig } from './common/utils/cors-validator.util';
import { GlobalExceptionFilter, LogService } from './logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Создаем простой логгер
  const logger = app.get(LogService);

  // Используем глобальный фильтр исключений с логгером
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Настраиваем CORS с валидацией
  const corsConfig = createCorsConfig(process.env.CORS_ORIGIN);
  app.enableCors(corsConfig);

  const portEnv = process.env.PORT;
  if (!portEnv) {
    throw new Error('PORT environment variable is required');
  }
  const port = validatePort(portEnv);
  await app.listen(port);

  logger.log(`Приложение запущено на порту ${port}`);
}

void bootstrap();
