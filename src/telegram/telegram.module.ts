import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { TelegramBotProvider } from './providers/telegram-bot.provider';

import { SessionService } from './services/session.service';
import { MessageService } from './services/message.service';
import { AccessService } from './services/access.service';
import { PsychologicalTestService } from './services/psychological-test.service';
import { CharacterService } from './services/character.service';
import { CharacterActionService } from './services/character-action.service';

import { CommandHandler } from './handlers/command.handler';
import { MessageHandler } from './handlers/message.handler';

import { Character } from '../character/entities/character.entity';
import { Need } from '../character/entities/need.entity';
import { CharacterMemory } from '../character/entities/character-memory.entity';
import { AccessKey } from '../access/entities/access-key.entity';
import { PsychologicalTest } from '../psychological-test/entities/psychological-test.entity';
import { Dialog } from '../dialog/entities/dialog.entity';
import { Message } from '../dialog/entities/message.entity';
import { Story } from '../story/entities/story.entity';
import { StoryEvent } from '../story/entities/story-event.entity';

import { OpenaiModule } from '../openai/openai.module';
import { UserModule } from '../user/user.module';
import { DialogModule } from '../dialog/dialog.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN'),
        middlewares: [],
        include: [TelegramModule],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Character,
      Need,
      CharacterMemory,
      AccessKey,
      PsychologicalTest,
      Dialog,
      Message,
      User,
      Story,
      StoryEvent,
    ]),
    OpenaiModule,
    UserModule,
    DialogModule,
    CharacterModule,
  ],
  providers: [
    TelegramBotProvider,
    TelegramService,
    TelegramUpdate,
    SessionService,
    MessageService,
    AccessService,
    PsychologicalTestService,
    CharacterService,
    CommandHandler,
    MessageHandler,
    CharacterActionService,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
