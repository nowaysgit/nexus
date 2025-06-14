import { Module, Global } from '@nestjs/common';
import { LoggingModule } from '../logging';
import { EncryptionService } from './encryption.service';
import { ApiKeyService } from './api-key.service';

/**
 * Модуль инфраструктурных сервисов
 * Предоставляет базовые инфраструктурные сервисы: шифрование, API ключи
 */
@Global()
@Module({
  imports: [LoggingModule],
  providers: [EncryptionService, ApiKeyService],
  exports: [EncryptionService, ApiKeyService],
})
export class InfrastructureModule {}
