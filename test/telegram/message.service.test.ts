import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessageService } from '../../src/telegram/services/message.service';
import { MessageFormatterService } from '../../src/telegram/services/message-formatter.service';
import { KeyboardFormatterService } from '../../src/telegram/services/keyboard-formatter.service';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { CharacterManagementService } from '../../src/character/services/core/character-management.service';
import { TelegramService } from '../../src/telegram/telegram.service';
import { LogService } from '../../src/logging/log.service';
import { Context } from '../../src/telegram/interfaces/context.interface';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

describe('MessageService', () => {
  let service: MessageService;
  let _configService: jest.Mocked<ConfigService>;
  let messageFormatter: jest.Mocked<MessageFormatterService>;
  let keyboardFormatter: jest.Mocked<KeyboardFormatterService>;
  let _errorHandlingService: jest.Mocked<ErrorHandlingService>;
  let characterManagementService: jest.Mocked<CharacterManagementService>;
  let telegramService: jest.Mocked<TelegramService>;
  let _logService: jest.Mocked<LogService>;

  const mockCharacter: Character = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: CharacterGender.FEMALE,
    biography: 'Test biography',
    appearance: 'Привлекательная молодая женщина',
    personality: {
      traits: ['открытая', 'любознательная'],
      hobbies: ['чтение', 'музыка'],
      fears: ['одиночество'],
      values: ['честность', 'дружба'],
      musicTaste: ['поп', 'рок'],
      strengths: ['эмпатия', 'интеллект'],
      weaknesses: ['импульсивность'],
    },
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: ['общение', 'психология'],
    archetype: CharacterArchetype.COMPANION,
    affection: 50,
    trust: 60,
    energy: 80,
    relationshipStage: RelationshipStage.FRIENDSHIP,
    developmentStage: 'basic',
    isActive: true,
    isArchived: false,
    user: null,
    userId: null,
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: new Date(),
  } as Character;

  const mockContext = {
    chat: { id: 123456 },
    from: { id: 123456 },
    reply: jest.fn(),
    session: { state: 'main' },
  } as unknown as Context;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockMessageFormatter = {
      formatCharacterInfo: jest.fn(),
      formatCharacterStatus: jest.fn(),
      formatNewCharacterInfo: jest.fn(),
    };

    const mockKeyboardFormatter = {
      createMainMenuKeyboard: jest.fn(),
      createCharacterProfileKeyboard: jest.fn(),
      createActionKeyboard: jest.fn(),
    };

    const mockErrorHandlingService = {
      handleError: jest.fn(),
    };

    const mockCharacterManagementService = {
      getCharacterAnalysis: jest.fn(),
    };

    const mockTelegramService = {
      sendMessage: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MessageFormatterService, useValue: mockMessageFormatter },
        { provide: KeyboardFormatterService, useValue: mockKeyboardFormatter },
        { provide: ErrorHandlingService, useValue: mockErrorHandlingService },
        { provide: CharacterManagementService, useValue: mockCharacterManagementService },
        { provide: TelegramService, useValue: mockTelegramService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    _configService = module.get(ConfigService);
    messageFormatter = module.get(MessageFormatterService);
    keyboardFormatter = module.get(KeyboardFormatterService);
    _errorHandlingService = module.get(ErrorHandlingService);
    characterManagementService = module.get(CharacterManagementService);
    telegramService = module.get(TelegramService);
    _logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен быть определен', () => {
      expect(service).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение через TelegramService', async () => {
      const chatId = 123456;
      const message = 'Test message';
      const options = { parse_mode: 'Markdown' as const };

      telegramService.sendMessage.mockResolvedValue(undefined);

      await service.sendMessage(chatId, message, options);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(chatId, message, options);
    });

    it('должен обработать ошибку при отправке сообщения', async () => {
      const chatId = 123456;
      const message = 'Test message';
      const error = new Error('Send message error');

      telegramService.sendMessage.mockRejectedValue(error);

      await expect(service.sendMessage(chatId, message)).rejects.toThrow(error);
    });
  });

  describe('sendMessageToUser', () => {
    it('должен отправить сообщение пользователю с метаданными', async () => {
      const chatId = 123456;
      const message = 'Test message';
      const options = {
        characterId: 1,
        isProactive: true,
        actionType: 'greeting',
        metadata: { test: 'value' },
      };

      telegramService.sendMessage.mockResolvedValue(undefined);

      await service.sendMessageToUser(chatId, message, options);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(chatId, message, {
        parse_mode: 'Markdown',
        metadata: {
          characterId: 1,
          isProactive: true,
          actionType: 'greeting',
          test: 'value',
        },
      });
    });
  });

  describe('sendMainMenu', () => {
    it('должен отправить главное меню', async () => {
      const mockKeyboard = { inline_keyboard: [] };
      keyboardFormatter.createMainMenuKeyboard.mockReturnValue(mockKeyboard);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      await service.sendMainMenu(mockContext);

      expect(keyboardFormatter.createMainMenuKeyboard).toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith('Главное меню', {
        reply_markup: mockKeyboard,
      });
    });
  });

  describe('sendCharacterInfo', () => {
    it('должен отправить информацию о персонаже', async () => {
      const formattedInfo = 'Formatted character info';
      const mockKeyboard = { inline_keyboard: [] };

      messageFormatter.formatCharacterInfo.mockResolvedValue(formattedInfo);
      keyboardFormatter.createCharacterProfileKeyboard.mockResolvedValue(mockKeyboard);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      await service.sendCharacterInfo(mockContext, mockCharacter);

      expect(messageFormatter.formatCharacterInfo).toHaveBeenCalledWith({
        id: '1',
        name: 'Test Character',
        description: 'Test biography',
        isArchived: false,
        createdAt: mockCharacter.createdAt,
        updatedAt: mockCharacter.updatedAt,
      });
      expect(mockContext.reply).toHaveBeenCalledWith(formattedInfo, {
        parse_mode: 'Markdown',
        reply_markup: mockKeyboard,
      });
    });
  });

  describe('sendCharacterStatus', () => {
    it('должен отправить статус персонажа', async () => {
      const mockAnalysis = {
        characterId: '1',
        needsAnalysis: {
          needsByType: { SOCIAL: 50, EMOTIONAL: 60 },
          averageValue: 55,
          criticalNeeds: [],
          overallSatisfaction: 'good',
        },
        memoriesAnalysis: {
          totalMemories: 5,
          averageImportance: 0.7,
          importantMemoriesCount: 2,
          recentMemoriesCount: 3,
          memoryRetention: 'good',
        },
        activityAnalysis: {
          totalActions: 10,
          actionsByType: { COMMUNICATION: 5, EXPLORATION: 3 },
          recentActionsCount: 2,
          activityLevel: 'moderate',
        },
        overallState: 'good',
        createdAt: new Date(),
      };
      const formattedStatus = 'Formatted character status';
      const mockKeyboard = { inline_keyboard: [] };

      characterManagementService.getCharacterAnalysis.mockResolvedValue(mockAnalysis);
      messageFormatter.formatCharacterStatus.mockResolvedValue(formattedStatus);
      keyboardFormatter.createActionKeyboard.mockReturnValue(mockKeyboard);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      await service.sendCharacterStatus(mockContext, mockCharacter);

      expect(characterManagementService.getCharacterAnalysis).toHaveBeenCalledWith('1');
      expect(messageFormatter.formatCharacterStatus).toHaveBeenCalled();
      expect(keyboardFormatter.createActionKeyboard).toHaveBeenCalledWith('1', [
        'Подарок',
        'Комплимент',
        'Вопрос',
        'Игра',
        'Прогулка',
      ]);
      expect(mockContext.reply).toHaveBeenCalledWith(formattedStatus, {
        parse_mode: 'Markdown',
        reply_markup: mockKeyboard,
      });
    });
  });

  describe('sendNewCharacterInfo', () => {
    it('должен отправить информацию о новом персонаже', async () => {
      const formattedInfo = 'Formatted new character info';
      const mockKeyboard = { inline_keyboard: [] };

      messageFormatter.formatNewCharacterInfo.mockResolvedValue(formattedInfo);
      keyboardFormatter.createCharacterProfileKeyboard.mockResolvedValue(mockKeyboard);
      mockContext.reply = jest.fn().mockResolvedValue(undefined);

      await service.sendNewCharacterInfo(mockContext, mockCharacter);

      expect(messageFormatter.formatNewCharacterInfo).toHaveBeenCalledWith({
        id: '1',
        name: 'Test Character',
        description: 'Test biography',
        isArchived: false,
        createdAt: mockCharacter.createdAt,
        updatedAt: mockCharacter.updatedAt,
      });
      expect(mockContext.reply).toHaveBeenCalledWith(formattedInfo, {
        parse_mode: 'Markdown',
        reply_markup: mockKeyboard,
      });
    });
  });

  describe('error handling', () => {
    it('должен обрабатывать ошибки в sendMainMenu', async () => {
      const error = new Error('Keyboard error');
      keyboardFormatter.createMainMenuKeyboard.mockImplementation(() => {
        throw error;
      });

      await expect(service.sendMainMenu(mockContext)).rejects.toThrow();
    });

    it('должен обрабатывать ошибки в sendCharacterInfo', async () => {
      const error = new Error('Formatter error');
      messageFormatter.formatCharacterInfo.mockRejectedValue(error);

      await expect(service.sendCharacterInfo(mockContext, mockCharacter)).rejects.toThrow();
    });
  });
});
