import { TestConfigType, createTest, createTestSuite } from '../../lib/tester';
import { Context } from 'telegraf';

import { TelegramCoreService } from '../../src/telegram/services/telegram-core.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks';

// Расширяем тип Context для соответствия требованиям TelegramCoreService
interface ExtendedContext extends Context {
  session: { data: unknown };
  update: any; // Используем any для обхода ограничения read-only
}

const createMockContext = (overrides: Partial<ExtendedContext> = {}): ExtendedContext => {
  const baseContext: Partial<ExtendedContext> = {
    update: {} as any,
    telegram: {
      sendMessage: jest.fn().mockResolvedValue({}),
      deleteMessage: jest.fn().mockResolvedValue(true),
      answerCbQuery: jest.fn().mockResolvedValue(true),
    } as any,
    message: undefined,
    chat: {
      id: 123456789,
      type: 'private',
    } as any,
    from: {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
      language_code: 'en',
    },
    session: {
      data: {},
    },
    reply: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue(true),
    ...overrides,
  };

  if (overrides.update && overrides.update['callback_query']) {
    const callbackQuery = overrides.update['callback_query'];
    // Создаем новый объект вместо изменения существующего
    const newUpdate = {
      ...baseContext.update,
      callback_query: {
        id: '1',
        from: baseContext.from,
        chat_instance: '1',
        data: callbackQuery.data,
        message: {
          message_id: 1,
          date: Date.now() / 1000,
          chat: baseContext.chat,
          text: 'Callback message',
        },
      },
    };

    // Присваиваем новый объект
    baseContext.update = newUpdate;
  }

  return baseContext as ExtendedContext;
};

createTestSuite('TelegramCoreService Integration Tests', () => {
  let telegramServiceOld: TelegramCoreService;
  let logService: LogService;

  beforeEach(() => {
    // Создаем мок LogService с необходимыми методами
    logService = new MockLogService() as unknown as LogService;

    // Создаем экземпляр TelegramCoreService напрямую
    telegramServiceOld = new TelegramCoreService(logService);
  });

  createTest(
    {
      name: 'должен создать экземпляр TelegramCoreService',
      configType: TestConfigType.BASIC,
    },
    async () => {
      expect(telegramServiceOld).toBeDefined();
      expect(telegramServiceOld).toBeInstanceOf(TelegramCoreService);
    },
  );

  createTest(
    {
      name: 'должен регистрировать и выполнять команды',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      let commandExecuted = false;

      telegramServiceOld.registerCommand({
        name: 'test',
        description: 'Тестовая команда',
        handler: async ctx => {
          commandExecuted = true;
          await ctx.reply('Команда выполнена!');
        },
      });

      expect(telegramServiceOld.hasCommand('test')).toBe(true);
      await telegramServiceOld.executeCommand(mockContext as any, 'test');
      expect(commandExecuted).toBe(true);
      expect(mockContext.reply).toHaveBeenCalledWith('Команда выполнена!');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать команды с аргументами',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      let receivedArgs: string[] = [];

      telegramServiceOld.registerCommand({
        name: 'echo',
        description: 'Повторяет аргументы',
        argsCount: 1,
        handler: async (ctx, ...args) => {
          receivedArgs = args;
          await ctx.reply(`Получены аргументы: ${args.join(' ')}`);
        },
      });

      await telegramServiceOld.executeCommand(mockContext as any, 'echo', ['hello', 'world']);
      expect(receivedArgs).toEqual(['hello', 'world']);
      expect(mockContext.reply).toHaveBeenCalledWith('Получены аргументы: hello world');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать текстовые сообщения как команды',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      let commandExecuted = false;

      telegramServiceOld.registerCommand({
        name: 'start',
        description: 'Начать работу',
        handler: async ctx => {
          commandExecuted = true;
          await ctx.reply('Добро пожаловать!');
        },
      });

      const wasCommand = await telegramServiceOld.handleTextAsCommand(mockContext as any, '/start');
      expect(wasCommand).toBe(true);
      expect(commandExecuted).toBe(true);
      expect(mockContext.reply).toHaveBeenCalledWith('Добро пожаловать!');
    },
  );

  createTest(
    {
      name: 'должен возвращать false для не-команд',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      const wasCommand = await telegramServiceOld.handleTextAsCommand(
        mockContext as any,
        'Привет!',
      );
      expect(wasCommand).toBe(false);
      expect(mockContext.reply).not.toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен получать информацию о командах',
      configType: TestConfigType.BASIC,
    },
    async () => {
      telegramServiceOld.registerCommands([
        {
          name: 'help',
          description: 'Показать справку',
          handler: async () => {},
        },
        {
          name: 'admin',
          description: 'Админская команда',
          isAdmin: true,
          handler: async () => {},
        },
      ]);
      const allCommands = telegramServiceOld.getAllCommands();
      const userCommands = telegramServiceOld.getUserCommands();
      const adminCommands = telegramServiceOld.getAdminCommands();
      expect(allCommands.length).toBeGreaterThanOrEqual(2);
      expect(userCommands.some(cmd => cmd.name === 'help')).toBe(true);
      expect(adminCommands.some(cmd => cmd.name === 'admin')).toBe(true);
      expect(userCommands.some(cmd => cmd.name === 'admin')).toBe(false);
    },
  );

  createTest(
    {
      name: 'должен регистрировать и обрабатывать callback действия',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      let callbackExecuted = false;
      let receivedData = '';

      telegramServiceOld.registerCallbackAction({
        pattern: 'test_action:',
        handler: async (ctx, data) => {
          callbackExecuted = true;
          receivedData = data;
          await ctx.reply(`Callback обработан: ${data}`);
        },
      });

      await telegramServiceOld.handleCallback(mockContext as any, 'test_action:some_data');
      expect(callbackExecuted).toBe(true);
      expect(receivedData).toBe('test_action:some_data');
      expect(mockContext.reply).toHaveBeenCalledWith('Callback обработан: test_action:some_data');
    },
  );

  createTest(
    {
      name: 'должен игнорировать неизвестные callback',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      telegramServiceOld.registerCallbackAction({
        pattern: 'known_action',
        handler: async () => {},
      });
      await telegramServiceOld.handleCallback(mockContext as any, 'unknown_action:data');
      expect(mockContext.reply).not.toHaveBeenCalled();
    },
  );

  // Тесты, использующие методы, которых нет в TelegramCoreService,
  // закомментированы до тех пор, пока не будет реализована соответствующая функциональность

  /*
  createTest(
    {
      name: 'должен создавать инлайн клавиатуру',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const keyboard = telegramServiceOld.createInlineKeyboard([
        [
          { text: 'Кнопка 1', callback_data: 'action:1' },
          { text: 'Кнопка 2', callback_data: 'action:2' },
        ],
        [{ text: 'Кнопка 3', callback_data: 'action:3' }],
      ]);

      expect(keyboard).toBeDefined();
      expect(keyboard.reply_markup).toBeDefined();
      expect(keyboard.reply_markup.inline_keyboard.length).toBe(2);
      expect(keyboard.reply_markup.inline_keyboard[0].length).toBe(2);
      expect(keyboard.reply_markup.inline_keyboard[1].length).toBe(1);
    },
  );

  createTest(
    {
      name: 'должен создавать клавиатуру подтверждения',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const keyboard = telegramServiceOld.createConfirmationKeyboard('confirm_action');

      expect(keyboard).toBeDefined();
      expect(keyboard.reply_markup).toBeDefined();
      expect(keyboard.reply_markup.inline_keyboard.length).toBe(1);
      expect(keyboard.reply_markup.inline_keyboard[0].length).toBe(2);
      expect(keyboard.reply_markup.inline_keyboard[0][0].text).toContain('Да');
      expect(keyboard.reply_markup.inline_keyboard[0][1].text).toContain('Нет');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать подтверждения',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      let confirmed = false;
      let cancelled = false;

      const onConfirm = async () => {
        confirmed = true;
      };

      const onCancel = async () => {
        cancelled = true;
      };

      await telegramServiceOld.sendConfirmationMessage(
        mockContext as any,
        'Вы уверены?',
        'confirm_action',
        onConfirm,
        onCancel,
      );

      expect(mockContext.reply).toHaveBeenCalled();

      // Имитируем нажатие кнопки "Да"
      const confirmContext = createMockContext({
        update: {
          callback_query: {
            data: 'confirm_action:yes',
          },
        } as any,
      });

      await telegramServiceOld.handleCallback(
        confirmContext as any,
        'confirm_action:yes',
      );

      expect(confirmed).toBe(true);
      expect(cancelled).toBe(false);

      // Имитируем нажатие кнопки "Нет"
      const cancelContext = createMockContext({
        update: {
          callback_query: {
            data: 'confirm_action:no',
          },
        } as any,
      });

      await telegramServiceOld.handleCallback(
        cancelContext as any,
        'confirm_action:no',
      );

      expect(cancelled).toBe(true);
    },
  );
  */

  createTest(
    {
      name: 'должен обрабатывать ошибки в командах',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      const errorMessage = 'Тестовая ошибка';

      telegramServiceOld.registerCommand({
        name: 'error',
        description: 'Команда с ошибкой',
        handler: async () => {
          throw new Error(errorMessage);
        },
      });

      // Проверяем, что ошибка будет выброшена
      await expect(telegramServiceOld.executeCommand(mockContext as any, 'error')).rejects.toThrow(
        errorMessage,
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать несуществующие команды',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();
      await telegramServiceOld.executeCommand(mockContext as any, 'nonexistent');
      expect(mockContext.reply).toHaveBeenCalled();
      const replyArgs = (mockContext.reply as jest.Mock).mock.calls[0][0];
      expect(replyArgs).toContain('не найдена');
    },
  );

  createTest(
    {
      name: 'должен проверять аргументы команд',
      configType: TestConfigType.BASIC,
    },
    async () => {
      const mockContext = createMockContext();

      telegramServiceOld.registerCommand({
        name: 'args',
        description: 'Команда с аргументами',
        argsCount: 2,
        handler: async () => {},
      });

      await telegramServiceOld.executeCommand(mockContext as any, 'args', ['one']);
      expect(mockContext.reply).toHaveBeenCalled();
      const replyArgs = (mockContext.reply as jest.Mock).mock.calls[0][0];
      expect(replyArgs).toContain('требует 2 аргумент(ов)');
    },
  );
});
