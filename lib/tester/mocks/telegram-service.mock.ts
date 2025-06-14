import { LogService } from '../../../src/logging/log.service';

/**
 * Создает мок TelegramService для тестов
 */
export const createMockTelegramService = () => {
  const botMock = {
    telegram: {
      setWebhook: jest.fn().mockResolvedValue(true),
      getWebhookInfo: jest.fn().mockResolvedValue({ url: 'https://example.com/webhook' }),
      deleteWebhook: jest.fn().mockResolvedValue(true),
      sendMessage: jest.fn().mockResolvedValue(true),
      getMe: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 })
    },
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockReturnValue(undefined)
  };

  return {
    bot: botMock,
    onModuleInit: jest.fn().mockImplementation(async function() {
      try {
        // Проверяем и вызываем методы как в реальной реализации
        if (this.config.launchMode === 'webhook' && this.config.webhookUrl) {
          if (this.bot && this.bot.telegram) {
            await this.bot.telegram.setWebhook(`${this.config.webhookUrl}${this.config.webhookPath}`);
            await this.bot.telegram.getWebhookInfo();
          }
        } else {
          if (this.bot && this.bot.telegram) {
            await this.bot.telegram.deleteWebhook();
          }
          if (this.bot) {
            await this.bot.launch();
          }
        }
        return undefined;
      } catch (error) {
        this.logService.error(`Ошибка в моке: ${error.message}`);
        return undefined;
      }
    }),
    onApplicationShutdown: jest.fn().mockImplementation(function() {
      if (this.bot) {
        this.bot.stop('Остановка в тесте');
      }
    }),
    sendMessage: jest.fn().mockImplementation(async function(chatId, message, extra) {
      if (this.bot && this.bot.telegram) {
        const maxLength = this.config.maxMessageLength;
        const truncatedMessage =
          message.length > maxLength ? `${message.substring(0, maxLength - 3)}...` : message;
        
        return await this.bot.telegram.sendMessage(chatId, truncatedMessage, extra);
      }
      throw new Error('Объект bot.telegram не инициализирован в моке');
    }),
    getMe: jest.fn().mockImplementation(async function() {
      if (this.bot && this.bot.telegram) {
        return await this.bot.telegram.getMe();
      }
      return null;
    }),
    config: {
      token: 'test_token',
      launchMode: 'polling',
      maxMessageLength: 4096
    },
    logService: {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn()
    }
  };
};

/**
 * Готовый мок TelegramService для использования в тестах
 */
export const mockTelegramService = createMockTelegramService(); 