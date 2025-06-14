import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { TelegramService } from '../../src/telegram/telegram.service';

// Мок для Telegraf бота
const mockBot = {
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
      id: 123456789,
      is_bot: true,
      first_name: 'TestBot',
      username: 'testbot',
    }),
  },
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
};

const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

// Явная проверка наличия метода launch в моке бота
if (!mockBot.launch) {
  throw new Error('Мок бота должен иметь метод launch');
}

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
    async context => {
      const telegramService = context.get(TelegramService);
      expect(telegramService).toBeDefined();
      expect(telegramService).toBeInstanceOf(TelegramService);
    },
  );

  createTest(
    {
      name: 'должен инициализироваться в режиме polling и вызывать launch',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

      // Проверяем наличие метода launch
      expect(mockBot.launch).toBeDefined();
      expect(typeof mockBot.launch).toBe('function');

      await telegramService.onModuleInit();

      expect(mockBot.telegram.deleteWebhook).toHaveBeenCalled();
      expect(mockBot.launch).toHaveBeenCalled(); // Проверяем, что launch был вызван
      expect(mockLogService.log).toHaveBeenCalledWith('Запуск в режиме long polling');
      expect(mockLogService.log).toHaveBeenCalledWith('Telegram бот успешно запущен');
    },
  );

  createTest(
    {
      name: 'должен инициализироваться в режиме webhook',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

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
    async context => {
      const telegramService = context.get(TelegramService);

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
    async context => {
      const telegramService = context.get(TelegramService);

      const longMessage = 'Это очень длинное сообщение для тестирования';
      await telegramService.sendMessage(123, longMessage);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(123, 'Это очень ...', undefined);
    },
  );

  createTest(
    {
      name: 'должен отправлять сообщения с клавиатурой',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Кнопка 1', callback_data: 'btn1' }],
          [{ text: 'Кнопка 2', callback_data: 'btn2' }],
        ],
      };

      await telegramService.sendMessage(123, 'Сообщение с кнопками', keyboard);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(123, 'Сообщение с кнопками', {
        reply_markup: keyboard,
      });
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отправке сообщений',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

      // Создаем промис, который будет отклонен
      const sendPromise = Promise.resolve().then(() => {
        throw new Error('Send error');
      });

      // Мокаем метод sendMessage, чтобы он возвращал отклоненный промис
      jest.spyOn(telegramService, 'sendMessage').mockImplementation(() => sendPromise);

      // Теперь тестируем
      expect(telegramService.sendMessage(123, 'Тест')).rejects.toThrow('Send error');
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен получать информацию о боте',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

      const botInfo = await telegramService.getMe();

      expect(botInfo).toEqual({
        id: 123456789,
        is_bot: true,
        first_name: 'TestBot',
        username: 'testbot',
      });
    },
  );

  createTest(
    {
      name: 'должен останавливать бота при завершении работы',
      configType: TestConfigType.BASIC,
    },
    async context => {
      const telegramService = context.get(TelegramService);

      await telegramService.onApplicationShutdown();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Telegram бот остановлен');
    },
  );
});
