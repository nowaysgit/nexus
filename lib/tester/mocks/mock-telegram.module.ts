import { Module, DynamicModule } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';
import { mockTelegraf } from './telegraf-token.provider';
import { MockLogService } from './log.service.mock';
import { MockRollbarService } from './rollbar.service.mock';
import { mockConfigService } from './config.service.mock';
import { MockEventEmitter } from './event-emitter.mock';
import { TelegramService } from '../../../src/telegram/telegram.service';
import { LogService } from '../../../src/logging/log.service';
import { RollbarService } from '../../../src/logging/rollbar.service';
import { ConfigService } from '@nestjs/config';

// Моки для сервисов Telegram
export const mockTelegramCoreService = {
  sendMessage: jest.fn().mockResolvedValue(true),
  processUpdate: jest.fn().mockResolvedValue(true),
  getMe: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 }),
  onModuleInit: jest.fn(),
  onApplicationShutdown: jest.fn(),
};

export const mockAccessControlService = {
  checkAccess: jest.fn().mockResolvedValue(true),
  isUserAllowed: jest.fn().mockResolvedValue(true),
  addUserToAllowList: jest.fn().mockResolvedValue(true),
  removeUserFromAllowList: jest.fn().mockResolvedValue(true),
};

export const mockCharacterCreationService = {
  createCharacterFromTemplate: jest.fn().mockResolvedValue({
    id: 'test-character-id',
    name: 'Test Character',
  }),
  getAvailableTemplates: jest.fn().mockReturnValue(['template1', 'template2']),
};

export const mockMessageService = {
  sendMessage: jest.fn().mockResolvedValue(true),
  sendTypingAction: jest.fn().mockResolvedValue(true),
  sendPhoto: jest.fn().mockResolvedValue(true),
  editMessage: jest.fn().mockResolvedValue(true),
  deleteMessage: jest.fn().mockResolvedValue(true),
};

export const mockMessageFormatterService = {
  formatCharacterResponse: jest.fn().mockReturnValue('Formatted message'),
  formatSystemMessage: jest.fn().mockReturnValue('System message'),
  formatErrorMessage: jest.fn().mockReturnValue('Error message'),
};

export const mockKeyboardFormatterService = {
  createInlineKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [] }),
  createReplyKeyboard: jest.fn().mockReturnValue({ keyboard: [] }),
};

export const mockTelegramUserService = {
  findOrCreateUser: jest.fn().mockResolvedValue({
    id: 'test-user-id',
    telegramId: '123456789',
    username: 'testuser',
  }),
  getUserByTelegramId: jest.fn().mockResolvedValue({
    id: 'test-user-id',
    telegramId: '123456789',
    username: 'testuser',
  }),
};

export const mockTelegramInitializationService = {
  initializeBot: jest.fn().mockResolvedValue(true),
  setupWebhook: jest.fn().mockResolvedValue(true),
  removeWebhook: jest.fn().mockResolvedValue(true),
};

/**
 * Мок-модуль для Telegram, который можно использовать в тестах
 * Предоставляет моки для всех сервисов и компонентов Telegram
 */
@Module({})
export class MockTelegramModule {
  /**
   * Создает динамический модуль с моками для Telegram
   * @returns DynamicModule с моками для Telegram
   */
  static forRoot(): DynamicModule {
    // Создаем расширенный мок для ConfigService с конфигурацией Telegram
    const extendedMockConfigService = {
      ...mockConfigService,
      get: jest.fn((key: string): unknown => {
        if (key === 'telegram') {
          return {
            token: 'test-telegram-token',
            webhook: {
              enabled: false,
              domain: 'test-domain.com',
              path: '/telegram-webhook',
            },
            allowedUsers: ['123456789'],
            adminUsers: ['123456789'],
            botName: 'TestBot',
          };
        }
        // Для других ключей используем оригинальный мок
        return mockConfigService.get(key);
      }),
    } as typeof mockConfigService;

    return {
      module: MockTelegramModule,
      providers: [
        {
          provide: 'TelegramCoreService',
          useValue: mockTelegramCoreService,
        },
        {
          provide: 'AccessControlService',
          useValue: mockAccessControlService,
        },
        {
          provide: 'CharacterCreationService',
          useValue: mockCharacterCreationService,
        },
        {
          provide: 'MessageService',
          useValue: mockMessageService,
        },
        {
          provide: 'MessageFormatterService',
          useValue: mockMessageFormatterService,
        },
        {
          provide: 'KeyboardFormatterService',
          useValue: mockKeyboardFormatterService,
        },
        {
          provide: 'TelegramUserService',
          useValue: mockTelegramUserService,
        },
        {
          provide: 'TelegramInitializationService',
          useValue: mockTelegramInitializationService,
        },
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: RollbarService,
          useClass: MockRollbarService,
        },
        {
          provide: ConfigService,
          useValue: extendedMockConfigService,
        },
        {
          provide: 'EventEmitter2',
          useClass: MockEventEmitter,
        },
        {
          provide: TELEGRAF_TOKEN,
          useValue: mockTelegraf,
        },
        // Мок для TelegrafModule
        {
          provide: 'TelegrafModuleOptions',
          useValue: {
            token: 'test-telegram-token',
          },
        },
        {
          provide: TelegramService,
          useFactory: (bot, configService, logService) => {
            return new TelegramService(bot, configService, logService);
          },
          inject: [TELEGRAF_TOKEN, ConfigService, LogService],
        },
      ],
      exports: [
        'TelegramCoreService',
        'AccessControlService',
        'CharacterCreationService',
        'MessageService',
        'MessageFormatterService',
        'KeyboardFormatterService',
        'TelegramUserService',
        'TelegramInitializationService',
        LogService,
        RollbarService,
        ConfigService,
        'EventEmitter2',
        TELEGRAF_TOKEN,
        'TelegrafModuleOptions',
        TelegramService,
      ],
    };
  }
}
