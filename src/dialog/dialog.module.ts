import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dialog } from './entities/dialog.entity';
import { Message } from './entities/message.entity';
import { DialogService } from './services/dialog.service';
// DialogArchiveService удален - функциональность интегрирована в DialogService
import { DialogController } from './controllers/dialog.controller';

import { CommonModule } from '../common/common.module';
// CharacterModule не импортируется для избежания циклической зависимости
import { Character } from '../character/entities/character.entity';
import { LoggingModule } from '../logging';
import { ErrorHandlingModule } from '../common/utils/error-handling/error-handling.module';
import { IDialogModule } from '../common/interfaces';
import { CacheModule } from '../cache/cache.module';
import { MessageQueueModule } from '../message-queue/message-queue.module';
import { ValidationModule } from '../validation/validation.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dialog, Message, Character]),
    CommonModule,
    CacheModule,
    LoggingModule,
    MessageQueueModule,
    ErrorHandlingModule,
    ValidationModule,
    UserModule,
  ],
  controllers: [DialogController],
  providers: [DialogService],
  exports: [DialogService],
})
export class DialogModule implements IDialogModule {
  readonly id = 'dialog-module';
  readonly name = 'Dialog Module';
  readonly maxHistorySize = 100;
  readonly settings = {
    compressionEnabled: true,
    analyticsEnabled: true,
    cachingEnabled: true,
  };
}
