import { Test, TestingModule } from '@nestjs/testing';
import { CallbackHandler } from '../../../src/telegram/handlers/callback.handler';
import { LogService } from '../../../src/logging/log.service';
import { Context } from 'telegraf';

describe('CallbackHandler', () => {
  let handler: CallbackHandler;
  let mockLogService: jest.Mocked<LogService>;

  const mockContext = {
    from: { id: 12345 },
    callbackQuery: { data: 'main_menu', message: {} },
    reply: jest.fn(),
    answerCbQuery: jest.fn(),
    editMessageText: jest.fn(),
  } as unknown as Context;

  beforeEach(async () => {
    const mockLogServiceFactory = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CallbackHandler, { provide: LogService, useValue: mockLogServiceFactory }],
    }).compile();

    handler = module.get<CallbackHandler>(CallbackHandler);
    mockLogService = module.get(LogService);
  });

  describe('handleCallback', () => {
    it('should handle main_menu callback', async () => {
      const contextWithMainMenu = {
        ...mockContext,
        callbackQuery: { data: 'main_menu', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithMainMenu as unknown as Context);

      expect(contextWithMainMenu.answerCbQuery).toHaveBeenCalled();
      expect(contextWithMainMenu.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('🤖 *Главное меню*'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              [
                { text: '👥 Мои персонажи', callback_data: 'my_characters' },
                { text: '➕ Создать персонажа', callback_data: 'create_character' },
              ],
            ]),
          }),
        }),
      );
    });

    it('should handle my_characters callback', async () => {
      const contextWithMyCharacters = {
        ...mockContext,
        callbackQuery: { data: 'my_characters', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithMyCharacters as unknown as Context);

      expect(contextWithMyCharacters.answerCbQuery).toHaveBeenCalled();
      expect(contextWithMyCharacters.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('👥 *Ваши персонажи*'),
        expect.any(Object),
      );
    });

    it('should handle create_character callback', async () => {
      const contextWithCreateCharacter = {
        ...mockContext,
        callbackQuery: { data: 'create_character', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithCreateCharacter as unknown as Context);

      expect(contextWithCreateCharacter.answerCbQuery).toHaveBeenCalled();
      expect(contextWithCreateCharacter.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('🎭 *Создание персонажа*'),
        expect.any(Object),
      );
    });

    it('should handle help callback', async () => {
      const contextWithHelp = {
        ...mockContext,
        callbackQuery: { data: 'help', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithHelp as unknown as Context);

      expect(contextWithHelp.answerCbQuery).toHaveBeenCalled();
      expect(contextWithHelp.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('❓ *Справка*'),
        expect.any(Object),
      );
    });

    it('should handle character actions', async () => {
      const contextWithCharAction = {
        ...mockContext,
        callbackQuery: { data: 'char_123_info', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithCharAction as unknown as Context);

      expect(contextWithCharAction.answerCbQuery).toHaveBeenCalled();
      expect(mockLogService.debug).toHaveBeenCalledWith(
        'Обработка callback',
        expect.objectContaining({
          userId: 12345,
          action: 'char',
          entityId: '123',
        }),
      );
    });

    it('should handle dialog actions', async () => {
      const contextWithDialogAction = {
        ...mockContext,
        callbackQuery: { data: 'dialog_start', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithDialogAction as unknown as Context);

      expect(contextWithDialogAction.answerCbQuery).toHaveBeenCalled();
      expect(mockLogService.debug).toHaveBeenCalledWith(
        'Обработка callback',
        expect.objectContaining({
          userId: 12345,
          action: 'dialog',
        }),
      );
    });

    it('should handle settings actions', async () => {
      const contextWithSettingsAction = {
        ...mockContext,
        callbackQuery: { data: 'settings_show', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithSettingsAction as unknown as Context);

      expect(contextWithSettingsAction.answerCbQuery).toHaveBeenCalled();
      expect(contextWithSettingsAction.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('⚙️ *Настройки*'),
        expect.any(Object),
      );
    });

    it('should handle unknown callback action', async () => {
      const contextWithUnknownAction = {
        ...mockContext,
        callbackQuery: { data: 'unknown_action', message: {} },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await handler.handleCallback(contextWithUnknownAction as unknown as Context);

      expect(contextWithUnknownAction.answerCbQuery).toHaveBeenCalledWith(
        '❌ Неизвестное действие',
      );
      expect(mockLogService.warn).toHaveBeenCalledWith('Неизвестное callback действие', {
        action: 'unknown',
      });
    });

    it('should handle missing callback query', async () => {
      const contextWithoutCallback = {
        ...mockContext,
        callbackQuery: undefined,
      };

      await handler.handleCallback(contextWithoutCallback as unknown as Context);

      expect(mockContext.answerCbQuery).not.toHaveBeenCalled();
    });

    it('should handle callback query without data', async () => {
      const contextWithoutData = {
        ...mockContext,
        callbackQuery: {},
      };

      await handler.handleCallback(contextWithoutData as unknown as Context);

      expect(mockContext.answerCbQuery).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const contextWithError = {
        ...mockContext,
        callbackQuery: { data: 'main_menu', message: {} },
        editMessageText: jest.fn().mockRejectedValue(new Error('Test error')),
        answerCbQuery: jest.fn(),
      };

      await handler.handleCallback(contextWithError as unknown as Context);

      expect(mockLogService.error).toHaveBeenCalledWith(
        'Ошибка при обработке callback query',
        expect.objectContaining({
          error: 'Test error',
          callbackData: 'main_menu',
          userId: 12345,
        }),
      );
      expect(contextWithError.answerCbQuery).toHaveBeenCalledWith(
        'Произошла ошибка при обработке запроса',
      );
    });
  });

  describe('parseCallbackData', () => {
    it('should parse simple callback data', () => {
      const result = (handler as any).parseCallbackData('main_menu');
      expect(result).toEqual({
        action: 'main_menu',
        params: {},
      });
    });

    it('should parse callback data with entity ID', () => {
      const result = (handler as any).parseCallbackData('char_123_info');
      expect(result).toEqual({
        action: 'char',
        entityId: '123',
        subAction: 'info',
        params: {},
      });
    });

    it('should parse callback data with parameters', () => {
      const result = (handler as any).parseCallbackData('settings_show_param1=value1');
      expect(result).toEqual({
        action: 'settings',
        subAction: 'show',
        params: { param1: 'value1' },
      });
    });

    it('should handle empty callback data', () => {
      const result = (handler as any).parseCallbackData('');
      expect(result).toEqual({
        action: '',
        params: {},
      });
    });
  });
});
