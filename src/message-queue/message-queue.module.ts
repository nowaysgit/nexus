import { Module, Global } from '@nestjs/common';
import { LoggingModule } from '../logging';
import { CommonModule } from '../common/common.module';
import { MessageQueueService } from './message-queue.service';

/**
 * Модуль очереди сообщений
 * Предоставляет управление очередью сообщений для всего приложения
 */
@Global()
@Module({
  imports: [LoggingModule, CommonModule],
  providers: [MessageQueueService],
  exports: [MessageQueueService],
})
export class MessageQueueModule {}
