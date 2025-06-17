import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { TelegramService } from '../../src/telegram/telegram.service';
import { Test } from '@nestjs/testing';
import { TELEGRAF_TOKEN } from '../../src/telegram/constants/tokens';
import { ConfigService } from '@nestjs/config';
import { LogService } from '../../src/logging/log.service';

// Мок для LogService
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

// Мок для ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation(key => {
    if (key === 'telegram') {
      return {
        token: 'test_token',
        launchMode: 'polling',
        webhookUrl: 'https://example.com/webhook',
        maxMessageLength: 4000,
      };
    }
    return null;
  }),
};

// Типы для мока Telegraf
type MockTelegram = {
  setWebhook: jest.Mock;
  deleteWebhook: jest.Mock;
  getWebhookInfo: jest.Mock;
  sendMessage: jest.Mock;
  getMe: jest.Mock;
};

type MockBot = {
  telegram: MockTelegram;
  launch: jest.Mock;
  stop: jest.Mock;
};

// Мок для Telegraf бота
const mockBot: MockBot = {
  telegram: {
    setWebhook: jest.fn().mockResolvedValue(true),
    deleteWebhook: jest.fn().mockResolvedValue(true),
    getWebhookInfo: jest.fn().mockResolvedValue({
      url: 'https://example.com/webhook',
      has_custom_certificate: false,
      pending_update_count: 0,
    }),
    sendMessage: jest.fn().mockResolvedValue({
      message_id: 1,
      date: Date.now(),
      chat: { id: 123, type: 'private' },
      text: 'Test message',
    }),
    getMe: jest.fn().mockResolvedValue({
      id: 123456,
      is_bot: true,
      first_name: 'TestBot',
      username: 'test_bot',
    }),
  },
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};

createTestSuite('TelegramService Tests', () => {
  // Сбрасываем состояние моков перед каждым тестом
  beforeEach(() => {
    jest.clearAllMocks();
  });

  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль с необходимыми провайдерами
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);
      expect(telegramService).toBeDefined();
      expect(telegramService).toBeInstanceOf(TelegramService);
    },
  );

  createTest(
    {
      name: 'должен инициализироваться в режиме polling и вызывать launch',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Настраиваем мок для режима polling
      mockConfigService.get.mockImplementation(key => {
        if (key === 'telegram') {
          return {
            token: 'test_token',
            launchMode: 'polling',
            maxMessageLength: 4000,
          };
        }
        return null;
      });

      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      await telegramService.onModuleInit();

      expect(mockBot.telegram.deleteWebhook).toHaveBeenCalled();
      expect(mockBot.launch).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Запуск в режиме long polling');
      expect(mockLogService.log).toHaveBeenCalledWith('Telegram бот успешно запущен');
    },
  );

  createTest(
    {
      name: 'должен инициализироваться в режиме webhook',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Настраиваем мок для режима webhook
      mockConfigService.get.mockImplementation(key => {
        if (key === 'telegram') {
          return {
            token: 'test_token',
            launchMode: 'webhook',
            webhookUrl: 'https://example.com/webhook',
            webhookPath: '',
            maxMessageLength: 4000,
          };
        }
        return null;
      });

      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      await telegramService.onModuleInit();

      expect(mockBot.telegram.setWebhook).toHaveBeenCalledWith('https://example.com/webhook');
      expect(mockBot.telegram.getWebhookInfo).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Запуск в режиме webhook: https://example.com/webhook',
      );
    },
  );

  createTest(
    {
      name: 'должен отправлять сообщения',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      await telegramService.sendMessage(123, 'Тестовое сообщение');

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123,
        'Тестовое сообщение',
        undefined,
      );
    },
  );

  createTest(
    {
      name: 'должен обрезать длинные сообщения',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Настраиваем мок с маленьким maxMessageLength
      mockConfigService.get.mockImplementation(key => {
        if (key === 'telegram') {
          return {
            token: 'test_token',
            launchMode: 'polling',
            maxMessageLength: 10, // Максимальная длина сообщения - 10 символов
          };
        }
        return null;
      });

      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      const longMessage = 'Это очень длинное сообщение для тестирования';
      await telegramService.sendMessage(123, longMessage);

      // Проверяем, что вызван sendMessage с обрезанным сообщением
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();

      // Проверяем, что длина сообщения не превышает максимальную
      const mockCalls = mockBot.telegram.sendMessage.mock.calls;
      if (mockCalls && mockCalls.length > 0) {
        // Безопасно извлекаем аргументы вызова
        const args = mockCalls[0];
        if (args && args.length > 1) {
          const sentMessage = String(args[1] || '');
          expect(sentMessage.length).toBeLessThanOrEqual(10);
          // Проверяем, что сообщение начинается с начала оригинального сообщения
          expect(sentMessage.startsWith('Это')).toBe(true);
        }
      } else {
        fail('Метод sendMessage не был вызван');
      }
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отправке сообщений',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      // Мокаем ошибку при отправке сообщения
      mockBot.telegram.sendMessage.mockRejectedValueOnce(new Error('Тестовая ошибка'));

      await expect(telegramService.sendMessage(123, 'Тестовое сообщение')).rejects.toThrow();
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен получать информацию о боте',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      const botInfo = await telegramService.getMe();

      expect(mockBot.telegram.getMe).toHaveBeenCalled();
      expect(botInfo).toBeDefined();
      expect(botInfo).toHaveProperty('id', 123456);
      expect(botInfo).toHaveProperty('username', 'test_bot');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать отсутствие telegram при getMe',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль с ботом без telegram
      const botWithoutTelegram = { ...mockBot, telegram: undefined };

      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: botWithoutTelegram },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      const botInfo = await telegramService.getMe();

      expect(botInfo).toBeNull();
      expect(mockLogService.warn).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать остановку приложения',
      configType: TestConfigType.BASIC,
    },
    async _context => {
      // Создаем тестовый модуль
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: LogService, useValue: mockLogService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TELEGRAF_TOKEN, useValue: mockBot },
          TelegramService,
        ],
      }).compile();

      const telegramService = moduleRef.get(TelegramService);

      telegramService.onApplicationShutdown();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Останавливаем Telegram бота...');
    },
  );
});
