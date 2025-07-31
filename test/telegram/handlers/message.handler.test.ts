import { Test, TestingModule } from '@nestjs/testing';
import { MessageHandler } from '../../../src/telegram/handlers/message.handler';
import { LogService } from '../../../src/logging/log.service';
import { MessageService } from '../../../src/telegram/services/message.service';
import { DialogService } from '../../../src/dialog/services/dialog.service';
import { CharacterService } from '../../../src/character/services/core/character.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { CharacterBehaviorService } from '../../../src/character/services/behavior/character-behavior.service';
import { ActionExecutorService } from '../../../src/character/services/action/action-executor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Dialog } from '../../../src/dialog/entities/dialog.entity';
import { ModuleRef } from '@nestjs/core';
import { MessageFormatterService } from '../../../src/telegram/services/message-formatter.service';
import { AccessControlService } from '../../../src/telegram/services/access-control.service';
import { ConfigService } from '@nestjs/config';
import { MessageProcessingCoordinator } from '../../../src/character/services/core/message-processing-coordinator.service';
import { Context } from '../../../src/telegram/interfaces/context.interface';

describe('MessageHandler', () => {
  let handler: MessageHandler;
  let _mockLogService: jest.Mocked<LogService>;
  let _mockMessageService: jest.Mocked<MessageService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockCharacterService: jest.Mocked<CharacterService>;
  let mockAccessControlService: jest.Mocked<AccessControlService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockMessageProcessingCoordinator: jest.Mocked<MessageProcessingCoordinator>;
  let mockDialogRepository: jest.Mocked<any>;

  const mockContext = {
    from: { id: 12345 },
    message: { text: 'Hello' },
    reply: jest.fn(),
    sendChatAction: jest.fn(),
    session: { state: 'initial', activeCharacterId: 1 },
  } as unknown as Context;

  beforeEach(async () => {
    const mockLogServiceFactory = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    const mockMessageServiceFactory = {
      sendMainMenu: jest.fn(),
      sendCharacterStatus: jest.fn(),
    };

    const mockDialogServiceFactory = {
      getDialogHistory: jest.fn(),
      saveUserMessage: jest.fn(),
      saveCharacterMessage: jest.fn(),
    };

    const mockCharacterServiceFactory = {
      findOne: jest.fn(),
    };

    const mockAccessControlServiceFactory = {
      hasAccess: jest.fn(),
    };

    const mockConfigServiceFactory = {
      get: jest.fn(),
    };

    const mockMessageProcessingCoordinatorFactory = {
      processUserMessage: jest.fn(),
    };

    const mockDialogRepositoryFactory = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageHandler,
        { provide: LogService, useValue: mockLogServiceFactory },
        { provide: MessageService, useValue: mockMessageServiceFactory },
        { provide: DialogService, useValue: mockDialogServiceFactory },
        { provide: CharacterService, useValue: mockCharacterServiceFactory },
        { provide: NeedsService, useValue: {} },
        { provide: CharacterBehaviorService, useValue: {} },
        { provide: ActionExecutorService, useValue: {} },
        { provide: getRepositoryToken(Dialog), useValue: mockDialogRepositoryFactory },
        { provide: ModuleRef, useValue: {} },
        { provide: MessageFormatterService, useValue: {} },
        { provide: AccessControlService, useValue: mockAccessControlServiceFactory },
        { provide: ConfigService, useValue: mockConfigServiceFactory },
        {
          provide: MessageProcessingCoordinator,
          useValue: mockMessageProcessingCoordinatorFactory,
        },
      ],
    }).compile();

    handler = module.get<MessageHandler>(MessageHandler);
    _mockLogService = module.get(LogService);
    _mockMessageService = module.get(MessageService);
    mockDialogService = module.get(DialogService);
    mockCharacterService = module.get(CharacterService);
    mockAccessControlService = module.get(AccessControlService);
    mockConfigService = module.get(ConfigService);
    mockMessageProcessingCoordinator = module.get(MessageProcessingCoordinator);
    mockDialogRepository = module.get(getRepositoryToken(Dialog));

    // Настройка базовых моков
    mockAccessControlService.hasAccess.mockReturnValue(true);
    mockConfigService.get.mockReturnValue('access123');
  });

  describe('handleMessage', () => {
    it('should handle regular message for authorized user', async () => {
      const mockCharacter = { id: 1, name: 'Test Character' } as any;
      const mockDialog = { id: 1, telegramId: '12345', characterId: 1 };
      const mockResponse = { response: 'Hello back!', analysis: {} as any };
      const mockUserMessage = { id: 1, content: 'Hello' } as any;

      mockCharacterService.findOne.mockResolvedValue(mockCharacter);
      mockDialogRepository.findOne.mockResolvedValue(mockDialog);
      mockDialogService.getDialogHistory.mockResolvedValue([]);
      mockMessageProcessingCoordinator.processUserMessage.mockResolvedValue(mockResponse);
      mockDialogService.saveUserMessage.mockResolvedValue(mockUserMessage);
      mockDialogService.saveCharacterMessage.mockResolvedValue(undefined);

      await handler.handleMessage(mockContext);

      expect(mockAccessControlService.hasAccess).toHaveBeenCalledWith(12345);
      expect(mockCharacterService.findOne).toHaveBeenCalledWith(1);
      expect(mockContext.sendChatAction).toHaveBeenCalledWith('typing');
      expect(mockMessageProcessingCoordinator.processUserMessage).toHaveBeenCalledWith(
        mockCharacter,
        12345,
        'Hello',
        [],
      );
      expect(mockContext.reply).toHaveBeenCalledWith('Hello back!');
    });

    it('should skip command messages', async () => {
      const commandContext = {
        ...mockContext,
        message: { text: '/start' },
      };

      await handler.handleMessage(commandContext as Context);

      expect(mockCharacterService.findOne).not.toHaveBeenCalled();
    });

    it('should handle missing message text', async () => {
      const contextWithoutText = {
        ...mockContext,
        message: {},
      };

      await handler.handleMessage(contextWithoutText as Context);

      expect(mockCharacterService.findOne).not.toHaveBeenCalled();
    });

    it('should handle missing user ID', async () => {
      const contextWithoutUser = {
        ...mockContext,
        from: undefined,
      };

      await handler.handleMessage(contextWithoutUser as Context);

      expect(mockCharacterService.findOne).not.toHaveBeenCalled();
    });

    it('should handle unauthorized user', async () => {
      mockAccessControlService.hasAccess.mockReturnValue(false);

      await handler.handleMessage(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('У вас нет доступа к этой функции.');
      expect(mockCharacterService.findOne).not.toHaveBeenCalled();
    });

    it('should handle access key input state', async () => {
      const accessKeyContext = {
        ...mockContext,
        session: { state: 'waiting_for_access_key' },
        message: { text: 'access123' },
      };

      await handler.handleMessage(accessKeyContext as Context);

      expect(mockContext.reply).toHaveBeenCalledWith('Доступ предоставлен!');
      expect(mockCharacterService.findOne).not.toHaveBeenCalled();
    });

    it('should handle invalid access key', async () => {
      const accessKeyContext = {
        ...mockContext,
        session: { state: 'waiting_for_access_key' },
        message: { text: 'wrong_key' },
      };

      await handler.handleMessage(accessKeyContext as Context);

      expect(mockContext.reply).toHaveBeenCalledWith('Неверный ключ доступа. Попробуйте еще раз.');
    });

    it('should handle missing character ID in session', async () => {
      const contextWithoutCharacter = {
        ...mockContext,
        session: { state: 'initial' },
      };

      await handler.handleMessage(contextWithoutCharacter as Context);

      expect(mockContext.reply).toHaveBeenCalledWith(
        'Ошибка: персонаж не выбран. Пожалуйста, выберите персонажа снова.',
      );
    });

    it('should handle character not found', async () => {
      mockCharacterService.findOne.mockResolvedValue(null);

      await handler.handleMessage(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith('Ошибка: персонаж не найден.');
    });

    it('should create new dialog when none exists', async () => {
      const mockCharacter = { id: 1, name: 'Test Character' } as any;
      const mockNewDialog = { id: 2, telegramId: '12345', characterId: 1 };
      const mockResponse = { response: 'Hello back!', analysis: {} as any };
      const mockUserMessage = { id: 1, content: 'Hello' } as any;

      mockCharacterService.findOne.mockResolvedValue(mockCharacter);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockDialogRepository.create.mockReturnValue(mockNewDialog);
      mockDialogRepository.save.mockResolvedValue(mockNewDialog);
      mockDialogService.getDialogHistory.mockResolvedValue([]);
      mockMessageProcessingCoordinator.processUserMessage.mockResolvedValue(mockResponse);
      mockDialogService.saveUserMessage.mockResolvedValue(mockUserMessage);
      mockDialogService.saveCharacterMessage.mockResolvedValue(undefined);

      await handler.handleMessage(mockContext);

      expect(mockDialogRepository.create).toHaveBeenCalledWith({
        telegramId: '12345',
        characterId: 1,
        isActive: true,
        lastInteractionDate: expect.any(Date),
      });
      expect(mockDialogRepository.save).toHaveBeenCalledWith(mockNewDialog);
    });
  });
});
