import { Module } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';
import { TelegramService } from '../../../src/telegram/telegram.service';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../../src/logging/log.service';
import { TelegramCoreService } from '../../../src/telegram/services/telegram-core.service';
import { TelegramUserService } from '../../../src/telegram/services/telegram-user.service';
import { AccessControlService } from '../../../src/telegram/services/access-control.service';
import { MessageFormatterService } from '../../../src/telegram/services/message-formatter.service';
import { KeyboardFormatterService } from '../../../src/telegram/services/keyboard-formatter.service';
import { MessageService } from '../../../src/telegram/services/message.service';
import { TelegramInitializationService } from '../../../src/telegram/services/telegram-initialization.service';
import { CharacterCreationService } from '../../../src/telegram/services/character-creation.service';
import { mockTelegramService } from './telegram-service.mock';

// Моки сервисов
export const mockTelegramCoreService = {
  processIncomingMessage: jest.fn().mockImplementation((message) => {
    console.log(`[MOCK] Обработано входящее сообщение: ${JSON.stringify(message)}`);
    return Promise.resolve({
      success: true,
      messageId: '12345',
      response: 'Тестовый ответ на сообщение',
    });
  }),
  processIncomingCommand: jest.fn().mockImplementation((command) => {
    console.log(`[MOCK] Обработана команда: ${JSON.stringify(command)}`);
    return Promise.resolve({
      success: true,
      messageId: '12345',
      response: 'Тестовый ответ на команду',
    });
  }),
};

export const mockAccessControlService = {
  isUserAllowed: jest.fn().mockReturnValue(true),
  isUserAdmin: jest.fn().mockReturnValue(false),
  hasAccess: jest.fn().mockResolvedValue(true),
};

export const mockCharacterCreationService = {
  createCharacter: jest.fn().mockImplementation((data) => {
    console.log(`[MOCK] Создан персонаж: ${JSON.stringify(data)}`);
    return Promise.resolve({
      id: 'test-char-id',
      name: data.name || 'Тестовый персонаж',
      createdAt: new Date(),
    });
  }),
};

export const mockMessageService = {
  processMessage: jest.fn().mockImplementation((message) => {
    console.log(`[MOCK] Обработано сообщение: ${JSON.stringify(message)}`);
    return Promise.resolve({
      success: true,
      responseText: 'Тестовый ответ',
    });
  }),
};

export const mockMessageFormatterService = {
  formatMessage: jest.fn().mockImplementation((message) => {
    return `[MOCK] ${message}`;
  }),
};

export const mockKeyboardFormatterService = {
  createKeyboard: jest.fn().mockImplementation((buttons) => {
    return { keyboard: buttons || [], one_time_keyboard: true };
  }),
};

export const mockTelegramUserService = {
  createUserIfNotExists: jest.fn().mockImplementation((userData) => {
    console.log(`[MOCK] Создан пользователь: ${JSON.stringify(userData)}`);
    return Promise.resolve({
      id: 'test-user-id',
      telegramId: userData.telegramId || '123456789',
      username: userData.username || 'test_user',
      firstName: userData.firstName || 'Test',
      lastName: userData.lastName || 'User',
      createdAt: new Date(),
    });
  }),
};

export const mockTelegramInitializationService = {
  initialize: jest.fn().mockResolvedValue(true),
};

// Мок для Telegraf
const telegrafMock = {
  telegram: {
    sendMessage: jest.fn().mockResolvedValue(true),
    getMe: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 }),
    setWebhook: jest.fn().mockResolvedValue(true),
    getWebhookInfo: jest.fn().mockResolvedValue({ url: '' }),
    deleteWebhook: jest.fn().mockResolvedValue(true)
  },
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockReturnValue(undefined)
};

// Мок для ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key) => {
    if (key === 'telegram') {
      return {
        token: 'test-bot-token',
        launchMode: 'polling',
        maxMessageLength: 4096
      };
    }
    return null;
  })
};

// Мок для LogService
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn()
};

@Module({
  providers: [
    {
      provide: TELEGRAF_TOKEN,
      useValue: telegrafMock,
    },
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
    {
      provide: LogService,
      useValue: mockLogService,
    },
    {
      provide: TelegramService,
      useValue: mockTelegramService,
    },
    {
      provide: TelegramCoreService,
      useValue: mockTelegramCoreService,
    },
    {
      provide: TelegramUserService,
      useValue: mockTelegramUserService,
    },
    {
      provide: AccessControlService,
      useValue: mockAccessControlService,
    },
    {
      provide: MessageFormatterService,
      useValue: mockMessageFormatterService,
    },
    {
      provide: KeyboardFormatterService,
      useValue: mockKeyboardFormatterService,
    },
    {
      provide: MessageService,
      useValue: mockMessageService,
    },
    {
      provide: TelegramInitializationService,
      useValue: mockTelegramInitializationService,
    },
    {
      provide: CharacterCreationService,
      useValue: mockCharacterCreationService,
    },
  ],
  exports: [
    TELEGRAF_TOKEN,
    ConfigService,
    LogService,
    TelegramService,
    TelegramCoreService,
    TelegramUserService,
    AccessControlService,
    MessageFormatterService,
    KeyboardFormatterService,
    MessageService,
    TelegramInitializationService,
    CharacterCreationService,
  ],
})
export class MockTelegramModule {} 