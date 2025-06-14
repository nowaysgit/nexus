import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../logging/logging.module';
import { ErrorHandlingService } from './utils/error-handling/error-handling.service';

/**
 * Общий Common модуль
 * Содержит общие утилиты и сервисы, которые не были вынесены в отдельные модули
 */
@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [ErrorHandlingService],
  exports: [ErrorHandlingService],
})
export class CommonModule {}
