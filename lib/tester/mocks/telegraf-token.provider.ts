import { Provider } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';

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
  stop: jest.fn().mockReturnValue(undefined),
  use: jest.fn().mockImplementation((middleware) => telegrafMock),
  on: jest.fn().mockImplementation((event, handler) => telegrafMock),
  command: jest.fn().mockImplementation((command, handler) => telegrafMock),
  start: jest.fn().mockImplementation((handler) => telegrafMock),
  help: jest.fn().mockImplementation((handler) => telegrafMock)
};

// Провайдер для TELEGRAF_TOKEN, который можно использовать в тестах
export const TelegrafTokenProvider: Provider = {
  provide: TELEGRAF_TOKEN,
  useValue: telegrafMock,
};

// Экспортируем мок для доступа в тестах
export const mockTelegraf = telegrafMock; 