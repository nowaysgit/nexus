import { Module, Global } from '@nestjs/common';
import { LoggingModule } from '../logging';
import { CacheService } from './cache.service';

/**
 * Модуль кеширования
 * Предоставляет единый сервис кеширования для всего приложения
 */
@Global()
@Module({
  imports: [LoggingModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
