import { Test, TestingModule } from '@nestjs/testing';
import { CommandHandler } from '../../../src/telegram/handlers/command.handler';
import { LogService } from '../../../src/logging/log.service';
import { ConfigService } from '@nestjs/config';
import { TelegramInitializationService } from '../../../src/telegram/services/telegram-initialization.service';
import { UserService } from '../../../src/user/services/user.service';
import { MessageService } from '../../../src/telegram/services/message.service';
import { ActionExecutorService } from '../../../src/character/services/action/action-executor.service';
import { CharacterBehaviorService } from '../../../src/character/services/behavior/character-behavior.service';
import { CharacterManagementService } from '../../../src/character/services/core/character-management.service';
import { CharacterService } from '../../../src/character/services/core/character.service';
import { DialogService } from '../../../src/dialog/services/dialog.service';
import { AccessControlService } from '../../../src/telegram/services/access-control.service';
import { CharacterCreationService } from '../../../src/telegram/services/character-creation.service';
import { Context } from '../../../src/telegram/interfaces/context.interface';

describe('CommandHandler', () => {
  let handler: CommandHandler;
  let mockLogService: jest.Mocked<LogService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockAccessControlService: jest.Mocked<AccessControlService>;
  let mockMessageService: jest.Mocked<MessageService>;
  let mockCharacterService: jest.Mocked<CharacterService>;

  const mockContext = {
    from: { id: 12345 },
    reply: jest.fn(),
    answerCbQuery: jest.fn(),
    session: { state: 'initial' },
  } as unknown as Context;

  beforeEach(async () => {
    const mockLogServiceFactory = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    const mockConfigServiceFactory = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'ADMIN_TELEGRAM_IDS') return '12345,67890';
        return defaultValue || '';
      }),
    };

    const mockAccessControlServiceFactory = {
      hasAccess: jest.fn(),
    };

    const mockMessageServiceFactory = {
      sendMainMenu: jest.fn(),
      sendHelpMessage: jest.fn(),
      sendArchetypeSelection: jest.fn(),
    };

    const mockCharacterServiceFactory = {
      findByUserId: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandHandler,
        { provide: LogService, useValue: mockLogServiceFactory },
        { provide: ConfigService, useValue: mockConfigServiceFactory },
        { provide: TelegramInitializationService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: MessageService, useValue: mockMessageServiceFactory },
        { provide: ActionExecutorService, useValue: {} },
        { provide: CharacterBehaviorService, useValue: {} },
        { provide: CharacterManagementService, useValue: {} },
        { provide: CharacterService, useValue: mockCharacterServiceFactory },
        { provide: DialogService, useValue: {} },
        { provide: AccessControlService, useValue: mockAccessControlServiceFactory },
        { provide: CharacterCreationService, useValue: {} },
      ],
    }).compile();

    handler = module.get<CommandHandler>(CommandHandler);
    mockLogService = module.get(LogService);
    mockConfigService = module.get(ConfigService);
    mockAccessControlService = module.get(AccessControlService);
    mockMessageService = module.get(MessageService);
    mockCharacterService = module.get(CharacterService);

    // Настройка базовых моков
    mockAccessControlService.hasAccess.mockReturnValue(true);
  });

  describe('handleStart', () => {
    it('should handle start command for authorized user', async () => {
      await handler.handleStart(mockContext);

      expect(mockAccessControlService.hasAccess).toHaveBeenCalledWith(12345);
      expect(mockMessageService.sendMainMenu).toHaveBeenCalledWith(mockContext);
      expect(mockContext.session.state).toBe('initial');
    });

    it('should deny access for unauthorized user', async () => {
      mockAccessControlService.hasAccess.mockReturnValue(false);

      await handler.handleStart(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('У вас нет доступа к этому боту.');
      expect(mockMessageService.sendMainMenu).not.toHaveBeenCalled();
    });

    it('should handle missing user ID', async () => {
      const contextWithoutUser = { ...mockContext, from: undefined };

      await handler.handleStart(contextWithoutUser as Context);

      expect(mockMessageService.sendMainMenu).not.toHaveBeenCalled();
    });
  });

  describe('handleHelp', () => {
    it('should handle help command for authorized user', async () => {
      await handler.handleHelp(mockContext);

      expect(mockAccessControlService.hasAccess).toHaveBeenCalledWith(12345);
      expect(mockMessageService.sendHelpMessage).toHaveBeenCalledWith(mockContext);
    });

    it('should deny access for unauthorized user', async () => {
      mockAccessControlService.hasAccess.mockReturnValue(false);

      await handler.handleHelp(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('У вас нет доступа к этому боту.');
      expect(mockMessageService.sendHelpMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleCharacters', () => {
    it('should show characters list for user with characters', async () => {
      const mockCharacters = [
        { id: 1, name: 'Character 1' } as any,
        { id: 2, name: 'Character 2' } as any,
      ];
      mockCharacterService.findByUserId.mockResolvedValue(mockCharacters);

      await handler.handleCharacters(mockContext);

      expect(mockCharacterService.findByUserId).toHaveBeenCalledWith('12345');
      expect(mockContext.reply).toHaveBeenCalledWith(
        'Ваши персонажи:',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              [{ text: 'Character 1', callback_data: 'info_1' }],
              [{ text: 'Character 2', callback_data: 'info_2' }],
            ]),
          }),
        }),
      );
    });

    it('should show create character option when no characters exist', async () => {
      mockCharacterService.findByUserId.mockResolvedValue([]);

      await handler.handleCharacters(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        'У вас пока нет персонажей. Вы можете создать персонажа.',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: [[{ text: 'Создать персонажа', callback_data: 'create_character' }]],
          }),
        }),
      );
    });

    it('should deny access for unauthorized user', async () => {
      mockAccessControlService.hasAccess.mockReturnValue(false);

      await handler.handleCharacters(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('У вас нет доступа к этому боту.');
      expect(mockCharacterService.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('handleCreate', () => {
    it('should show archetype selection for authorized user', async () => {
      await handler.handleCreate(mockContext);

      expect(mockAccessControlService.hasAccess).toHaveBeenCalledWith(12345);
      expect(mockMessageService.sendArchetypeSelection).toHaveBeenCalledWith(mockContext);
    });

    it('should deny access for unauthorized user', async () => {
      mockAccessControlService.hasAccess.mockReturnValue(false);

      await handler.handleCreate(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('У вас нет доступа к этому боту.');
      expect(mockMessageService.sendArchetypeSelection).not.toHaveBeenCalled();
    });
  });

  describe('handleAdminCommand', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('12345');
    });

    it('should handle generate_key command for admin', async () => {
      await handler.handleAdminCommand(mockContext, '/generate_key');

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Ключ доступа создан:'),
      );
    });

    it('should handle list_keys command for admin', async () => {
      await handler.handleAdminCommand(mockContext, '/list_keys');

      expect(mockContext.reply).toHaveBeenCalledWith('Ключи доступа не найдены.');
    });

    it('should handle deactivate_key command for admin', async () => {
      await handler.handleAdminCommand(mockContext, '/deactivate_key test_key');

      expect(mockContext.reply).toHaveBeenCalledWith('✅ Ключ test_key деактивирован.');
    });

    it('should handle deactivate_key command without key parameter', async () => {
      await handler.handleAdminCommand(mockContext, '/deactivate_key');

      expect(mockContext.reply).toHaveBeenCalledWith('Укажите ключ для деактивации.');
    });

    it('should handle unknown admin command', async () => {
      await handler.handleAdminCommand(mockContext, '/unknown_command');

      expect(mockContext.reply).toHaveBeenCalledWith('Неизвестная команда администратора.');
    });

    it('should deny access for non-admin user', async () => {
      const nonAdminContext = { ...mockContext, from: { id: 99999 }, reply: jest.fn() };

      await handler.handleAdminCommand(nonAdminContext as unknown as Context, '/generate_key');

      expect(nonAdminContext.reply).toHaveBeenCalledWith(
        'У вас нет прав для выполнения этой команды.',
      );
    });
  });

  describe('handleCallback', () => {
    it('should handle start_test callback', async () => {
      await handler.handleCallback(mockContext, 'start_test');

      expect(mockContext.answerCbQuery).toHaveBeenCalled();
      expect(mockMessageService.sendArchetypeSelection).toHaveBeenCalledWith(mockContext);
    });

    it('should handle create_character callback', async () => {
      await handler.handleCallback(mockContext, 'create_character');

      expect(mockContext.answerCbQuery).toHaveBeenCalled();
      expect(mockMessageService.sendArchetypeSelection).toHaveBeenCalledWith(mockContext);
    });

    it('should handle show_archetypes callback', async () => {
      await handler.handleCallback(mockContext, 'show_archetypes');

      expect(mockContext.answerCbQuery).toHaveBeenCalled();
      expect(mockMessageService.sendArchetypeSelection).toHaveBeenCalledWith(mockContext);
    });

    it('should handle test_answer_ callback', async () => {
      await handler.handleCallback(mockContext, 'test_answer_1');

      expect(mockContext.answerCbQuery).toHaveBeenCalled();
      expect(mockMessageService.sendArchetypeSelection).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('handleActionsCommand', () => {
    it('should handle actions command when no character selected', async () => {
      const contextWithoutCharacter = {
        ...mockContext,
        session: { data: {} },
      };

      await handler.handleActionsCommand(contextWithoutCharacter as Context);

      expect(mockContext.reply).toHaveBeenCalledWith(
        'Для управления действиями, сначала выберите персонажа с помощью команды /characters',
      );
    });

    it('should handle actions command when character not found', async () => {
      const contextWithCharacter = {
        ...mockContext,
        session: { data: { activeCharacterId: 1 } },
        reply: jest.fn(),
      };
      mockCharacterService.findOne.mockResolvedValue(null);

      await handler.handleActionsCommand(contextWithCharacter as unknown as Context);

      expect(contextWithCharacter.reply).toHaveBeenCalledWith('Ошибка: персонаж не найден');
    });
  });
});
