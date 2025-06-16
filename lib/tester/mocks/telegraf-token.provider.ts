import { Provider } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../../../src/telegram/constants';

// Типы для обработчиков Telegraf
type TelegrafMiddleware = (ctx: any, next: () => Promise<void>) => Promise<void>;
type TelegrafHandler = (ctx: any, next?: any) => Promise<void>;
type TelegrafUpdate = Record<string, any>;

// Создаем мок для Telegraf, который не будет делать реальных запросов к API
class MockTelegraf {
  private handlers: Map<string, TelegrafHandler[]> = new Map();
  private commandHandlers: Map<string, TelegrafHandler[]> = new Map();
  private actionHandlers: Map<string, TelegrafHandler[]> = new Map();
  private middlewares: TelegrafMiddleware[] = [];

  constructor(public token: string) {
    // Создаем базовые методы Telegram API
    this.telegram = {
      sendMessage: jest.fn().mockResolvedValue(true),
      getMe: jest.fn().mockResolvedValue({ username: 'test_bot', id: 123456 }),
      setWebhook: jest.fn().mockResolvedValue(true),
      getWebhookInfo: jest.fn().mockResolvedValue({ url: '' }),
      deleteWebhook: jest.fn().mockResolvedValue(true),
    };
  }

  // Свойство telegram для совместимости с Telegraf API
  public telegram: Record<string, jest.Mock>;

  // Базовые методы Telegraf
  use(middleware: TelegrafMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  on(event: string, handler: TelegrafHandler): this {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)?.push(handler);
    return this;
  }

  command(command: string, handler: TelegrafHandler): this {
    if (!this.commandHandlers.has(command)) {
      this.commandHandlers.set(command, []);
    }
    this.commandHandlers.get(command)?.push(handler);
    return this;
  }

  action(action: string | RegExp, handler: TelegrafHandler): this {
    const actionKey = action instanceof RegExp ? action.toString() : action;
    if (!this.actionHandlers.has(actionKey)) {
      this.actionHandlers.set(actionKey, []);
    }
    this.actionHandlers.get(actionKey)?.push(handler);
    return this;
  }

  // Методы для запуска и остановки бота
  async launch(): Promise<this> {
    return this;
  }

  async stop(): Promise<boolean> {
    return true;
  }

  // Методы для тестирования
  simulateUpdate(update: TelegrafUpdate): void {
    // Имитация получения обновления от Telegram
    this.middlewares.forEach(middleware => middleware(update, () => Promise.resolve()));

    if (update.message) {
      const handlers = this.handlers.get('message');
      handlers?.forEach(handler => handler(update.message, update));

      // Проверка на команду
      if (update.message.text && update.message.text.startsWith('/')) {
        const parts = update.message.text.split(' ');
        const command = parts[0].substring(1);
        const commandHandlers = this.commandHandlers.get(command);
        commandHandlers?.forEach(handler => handler(update.message, update));
      }
    }

    if (update.callback_query) {
      const handlers = this.handlers.get('callback_query');
      handlers?.forEach(handler => handler(update.callback_query, update));

      // Проверка на action
      const data = update.callback_query.data;
      this.actionHandlers.forEach((handlers, actionKey) => {
        if (typeof actionKey === 'string' && actionKey === data) {
          handlers.forEach(handler => handler(update.callback_query, update));
        } else if (actionKey.startsWith('/') && actionKey.endsWith('/')) {
          // Простая имитация RegExp
          const regex = new RegExp(actionKey.substring(1, actionKey.length - 1));
          if (regex.test(data)) {
            handlers.forEach(handler => handler(update.callback_query, update));
          }
        }
      });
    }
  }
}

// Создаем мок для Telegraf
export const mockTelegraf = new MockTelegraf('mock-token');

// Провайдер для TELEGRAF_TOKEN, который можно использовать в тестах
export const TelegrafTokenProvider: Provider = {
  provide: TELEGRAF_TOKEN,
  useValue: mockTelegraf,
};
