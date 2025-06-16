import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';
import { UserModule } from '../user/user.module';
import { DialogModule } from '../dialog/dialog.module';
import { CharacterModule } from '../character/character.module';
import { MessageProcessingModule } from '../character/message-processing.module';
import { ITelegramModule } from '../common/interfaces';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { TelegramCharacterSettings } from './entities/character-settings.entity';

// Core Handlers
import { CommandHandler } from './handlers/command.handler';
import { MessageHandler } from './handlers/message.handler';
import { CallbackHandler } from './handlers/callback.handler';

// Services
import { TelegramUserService } from './services/telegram-user.service';
import { TelegramCoreService } from './services/telegram-core.service';
import { TelegramInitializationService } from './services/telegram-initialization.service';
import { MessageService } from './services/message.service';
import { MessageFormatterService } from './services/message-formatter.service';
import { KeyboardFormatterService } from './services/keyboard-formatter.service';
import { AccessControlService } from './services/access-control.service';
import { CharacterCreationService } from './services/character-creation.service';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
      }),
    }),
    TypeOrmModule.forFeature([TelegramCharacterSettings]),
    CommonModule,
    ScheduleModule.forRoot(),
    UserModule,
    DialogModule,
    CharacterModule,
    MessageProcessingModule,
  ],
  providers: [
    // Main Services
    TelegramService,
    TelegramUpdate,

    // Handlers
    CommandHandler,
    MessageHandler,
    CallbackHandler,

    // Services
    TelegramUserService,
    TelegramCoreService,
    TelegramInitializationService,
    MessageService,
    // TelegramMessageQueueService,
    MessageFormatterService,
    KeyboardFormatterService,
    AccessControlService,
    CharacterCreationService,
  ],
  exports: [
    // Main Services
    TelegramService,

    // Services
    TelegramUserService,
    TelegramCoreService,
    TelegramInitializationService,
    MessageService,
    // TelegramMessageQueueService,
    MessageFormatterService,
    KeyboardFormatterService,
    AccessControlService,
  ],
})
export class TelegramModule implements ITelegramModule {
  readonly id = 'telegram-module';
  readonly name = 'Telegram Module';
  readonly settings = {
    webhookEnabled: false,
    pollingEnabled: true,
  };
}
