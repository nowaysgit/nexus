import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUpdate } from '../../src/telegram/telegram.update';
import { LogService } from '../../src/logging/log.service';
import { ConfigService } from '@nestjs/config';
import { CommandHandler } from '../../src/telegram/handlers/command.handler';
import { MessageHandler } from '../../src/telegram/handlers/message.handler';
import { CallbackHandler } from '../../src/telegram/handlers/callback.handler';
import { Context } from '../../src/telegram/interfaces/context.interface';

describe('TelegramUpdate', () => {
  let service: TelegramUpdate;
  let commandHandler: jest.Mocked<CommandHandler>;
  let messageHandler: jest.Mocked<MessageHandler>;
  let callbackHandler: jest.Mocked<CallbackHandler>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockCommandHandler = {
      handleAdminCommand: jest.fn().mockResolvedValue(undefined),
      handleStart: jest.fn().mockResolvedValue(undefined),
      handleHelp: jest.fn().mockResolvedValue(undefined),
      handleCharacters: jest.fn().mockResolvedValue(undefined),
      handleCreate: jest.fn().mockResolvedValue(undefined),
      handleActionsCommand: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageHandler = {
      handleMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockCallbackHandler = {
      handleCallback: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUpdate,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LogService, useValue: mockLogService },
        { provide: CommandHandler, useValue: mockCommandHandler },
        { provide: MessageHandler, useValue: mockMessageHandler },
        { provide: CallbackHandler, useValue: mockCallbackHandler },
      ],
    }).compile();

    service = module.get<TelegramUpdate>(TelegramUpdate);
    commandHandler = module.get(CommandHandler);
    messageHandler = module.get(MessageHandler);
    callbackHandler = module.get(CallbackHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCommand', () => {
    const mockCtx = {
      from: { id: 123456 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as unknown as Context;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle start command', async () => {
      await service.handleCommand(mockCtx, '/start');
      expect(commandHandler.handleStart).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle help command', async () => {
      await service.handleCommand(mockCtx, '/help');
      expect(commandHandler.handleHelp).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle characters command', async () => {
      await service.handleCommand(mockCtx, '/characters');
      expect(commandHandler.handleCharacters).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle create command', async () => {
      await service.handleCommand(mockCtx, '/create');
      expect(commandHandler.handleCreate).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle actions command', async () => {
      await service.handleCommand(mockCtx, '/actions');
      expect(commandHandler.handleActionsCommand).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle admin commands', async () => {
      await service.handleCommand(mockCtx, '/admin_test');
      expect(commandHandler.handleAdminCommand).toHaveBeenCalledWith(mockCtx, '/admin_test');
    });

    it('should handle unknown commands', async () => {
      await service.handleCommand(mockCtx, '/unknown');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Неизвестная команда. Используйте /help для получения списка доступных команд.',
      );
    });

    it('should handle commands with bot mention', async () => {
      await service.handleCommand(mockCtx, '/start@testbot');
      expect(commandHandler.handleStart).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle commands with arguments', async () => {
      await service.handleCommand(mockCtx, '/start arg1 arg2');
      expect(commandHandler.handleStart).toHaveBeenCalledWith(mockCtx);
    });

    it('should return early if ctx.from.id is not provided', async () => {
      const ctxWithoutUserId = { from: undefined } as unknown as Context;
      await service.handleCommand(ctxWithoutUserId, '/start');
      expect(commandHandler.handleStart).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    const mockCtx = {
      from: { id: 123456 },
    } as unknown as Context;

    it('should handle regular messages', async () => {
      await service.handleMessage(mockCtx);
      expect(messageHandler.handleMessage).toHaveBeenCalledWith(mockCtx);
    });

    it('should return early if ctx.from is not provided', async () => {
      const ctxWithoutFrom = { from: undefined } as unknown as Context;
      await service.handleMessage(ctxWithoutFrom);
      expect(messageHandler.handleMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        data: 'test_callback',
      },
    } as unknown as Context;

    it('should handle callback queries', async () => {
      await service.handleCallback(mockCtx);
      expect(callbackHandler.handleCallback).toHaveBeenCalledWith(mockCtx);
    });

    it('should return early if callbackQuery is not provided', async () => {
      const ctxWithoutCallback = {
        from: { id: 123456 },
        callbackQuery: undefined,
      } as unknown as Context;
      await service.handleCallback(ctxWithoutCallback);
      expect(callbackHandler.handleCallback).not.toHaveBeenCalled();
    });

    it('should return early if callbackQuery.data is not provided', async () => {
      const ctxWithoutData = {
        from: { id: 123456 },
        callbackQuery: {},
      } as unknown as Context;
      await service.handleCallback(ctxWithoutData);
      expect(callbackHandler.handleCallback).not.toHaveBeenCalled();
    });
  });

  it('should extend BaseService', () => {
    expect(service).toHaveProperty('withErrorHandling');
  });
});
