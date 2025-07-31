/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Файл содержит множество мок объектов для TypeORM Repository */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CharacterBehaviorService } from '../../../src/character/services/behavior/character-behavior.service';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterMemory } from '../../../src/character/entities/character-memory.entity';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { ActionExecutorService } from '../../../src/character/services/action/action-executor.service';
import { MemoryService } from '../../../src/character/services/core/memory.service';
import { CharacterService } from '../../../src/character/services/core/character.service';
import { MessageAnalysisService } from '../../../src/character/services/analysis/message-analysis.service';
import { ManipulationService } from '../../../src/character/services/manipulation/manipulation.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { MessageBehaviorService } from '../../../src/character/services/behavior/message-behavior.service';
import { EmotionalBehaviorService } from '../../../src/character/services/behavior/emotional-behavior.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { LogService } from '../../../src/logging/log.service';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { ActionType } from '../../../src/character/enums/action-type.enum';
import { MessageAnalysis } from '../../../src/character/interfaces/analysis.interfaces';

describe('CharacterBehaviorService', () => {
  let service: CharacterBehaviorService;
  let mockLogService: MockLogService;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;
  let mockMemoryRepository: jest.Mocked<Repository<CharacterMemory>>;
  let mockNeedsService: jest.Mocked<NeedsService>;
  let mockActionExecutorService: jest.Mocked<ActionExecutorService>;
  let mockMemoryService: jest.Mocked<MemoryService>;
  let mockCharacterService: jest.Mocked<CharacterService>;
  let mockMessageAnalysisService: jest.Mocked<MessageAnalysisService>;
  let mockManipulationService: jest.Mocked<ManipulationService>;
  let mockEmotionalStateService: jest.Mocked<EmotionalStateService>;
  let mockMessageBehaviorService: jest.Mocked<MessageBehaviorService>;
  let mockEmotionalBehaviorService: jest.Mocked<EmotionalBehaviorService>;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let testCharacter: Character;

  beforeEach(async () => {
    mockLogService = new MockLogService();
    mockCharacterRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as any;
    mockMemoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as any;
    mockNeedsService = {
      processNeedsGrowth: jest.fn(),
      getActiveNeeds: jest.fn(),
      updateNeed: jest.fn(),
    } as any;
    mockActionExecutorService = {
      isPerformingAction: jest.fn(),
      execute: jest.fn(),
      getCurrentAction: jest.fn(),
    } as any;
    mockMemoryService = {
      getRecentMemories: jest.fn(),
      createMemory: jest.fn(),
    } as any;
    mockCharacterService = {
      findById: jest.fn(),
    } as any;
    mockMessageAnalysisService = {
      analyzeUserMessage: jest.fn(),
    } as any;
    mockManipulationService = {
      analyzeManipulationOpportunity: jest.fn(),
    } as any;
    mockEmotionalStateService = {
      getEmotionalState: jest.fn(),
      updateEmotionalState: jest.fn(),
    } as any;
    mockMessageBehaviorService = {
      processUserMessageWithAnalysis: jest.fn(),
      processIncomingMessage: jest.fn(),
    } as any;
    mockEmotionalBehaviorService = {
      analyzeFrustration: jest.fn(),
      getFrustrationLevel: jest.fn(),
      getActiveFrustrationPatterns: jest.fn(),
    } as any;
    mockLLMService = {
      generateText: jest.fn(),
      generateJSON: jest.fn(),
    } as any;
    mockEventEmitter = {
      emit: jest.fn(),
    } as any;
    mockConfigService = {
      get: jest.fn(),
    } as any;

    // Настраиваем ConfigService
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'character.behavior.updateInterval': 300,
        'character.behavior.motivationThreshold': 70,
        'character.behavior.actionChance': 0.3,
        'character.maxMemorySize': 100,
        'character.behavior.defaultMemoryImportance': 5,
      };
      return config[key] || defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterBehaviorService,
        { provide: LogService, useValue: mockLogService },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
        { provide: getRepositoryToken(CharacterMemory), useValue: mockMemoryRepository },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: ActionExecutorService, useValue: mockActionExecutorService },
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: MessageAnalysisService, useValue: mockMessageAnalysisService },
        { provide: ManipulationService, useValue: mockManipulationService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: MessageBehaviorService, useValue: mockMessageBehaviorService },
        { provide: EmotionalBehaviorService, useValue: mockEmotionalBehaviorService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CharacterBehaviorService>(CharacterBehaviorService);

    // Создаем тестового персонажа
    testCharacter = new Character();
    testCharacter.id = 1;
    testCharacter.name = 'Test Character';
    testCharacter.archetype = CharacterArchetype.COMPANION;
    testCharacter.biography = 'Test character biography';
    testCharacter.appearance = 'Test character appearance';
    testCharacter.personality = {
      traits: [],
      hobbies: [],
      fears: [],
      values: [],
      musicTaste: [],
      strengths: [],
      weaknesses: [],
    };
    testCharacter.isActive = true;
    testCharacter.createdAt = new Date();
    testCharacter.updatedAt = new Date();
    testCharacter.age = 25;
  });

  afterEach(() => {
    // Останавливаем фоновые процессы после каждого теста
    service.stopBehaviorCycle();
  });

  describe('processCharacterBehavior', () => {
    it('должен обрабатывать поведение персонажа', async () => {
      const characterId = 1;
      const mockNeeds = [
        {
          id: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 80,
          threshold: 70,
          lastUpdated: new Date(),
        },
      ];

      mockNeedsService.processNeedsGrowth.mockResolvedValue(undefined);
      mockEmotionalBehaviorService.analyzeFrustration.mockResolvedValue(undefined);
      mockNeedsService.getActiveNeeds.mockResolvedValue(mockNeeds as any);
      mockActionExecutorService.isPerformingAction.mockReturnValue(false);
      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);

      await service.processCharacterBehavior(characterId);

      expect(mockNeedsService.processNeedsGrowth).toHaveBeenCalledWith(characterId);
      expect(mockEmotionalBehaviorService.analyzeFrustration).toHaveBeenCalledWith(characterId);
      expect(mockNeedsService.getActiveNeeds).toHaveBeenCalledWith(characterId);
      expect(mockActionExecutorService.isPerformingAction).toHaveBeenCalledWith(
        characterId.toString(),
      );
    });

    it('должен пропускать выполнение действия если персонаж уже занят', async () => {
      const characterId = 1;
      const mockNeeds = [
        {
          id: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 80,
          threshold: 70,
          lastUpdated: new Date(),
        },
      ];

      mockNeedsService.processNeedsGrowth.mockResolvedValue(undefined);
      mockEmotionalBehaviorService.analyzeFrustration.mockResolvedValue(undefined);
      mockNeedsService.getActiveNeeds.mockResolvedValue(mockNeeds as any);
      mockActionExecutorService.isPerformingAction.mockReturnValue(true); // Персонаж занят
      mockActionExecutorService.getCurrentAction.mockReturnValue({
        type: ActionType.SEND_MESSAGE,
        description: 'Отправка сообщения',
      });

      await service.processCharacterBehavior(characterId);

      // Не должен вызывать execute если персонаж занят
      expect(mockActionExecutorService.execute).not.toHaveBeenCalled();
    });

    it('должен пропускать выполнение действия если нет активных мотиваций', async () => {
      const characterId = 1;

      mockNeedsService.processNeedsGrowth.mockResolvedValue(undefined);
      mockEmotionalBehaviorService.analyzeFrustration.mockResolvedValue(undefined);
      mockNeedsService.getActiveNeeds.mockResolvedValue([]); // Нет активных потребностей
      mockActionExecutorService.isPerformingAction.mockReturnValue(false);

      await service.processCharacterBehavior(characterId);

      // Не должен вызывать execute если нет мотиваций
      expect(mockActionExecutorService.execute).not.toHaveBeenCalled();
    });
  });

  describe('processUserMessageWithAnalysis', () => {
    it('должен обрабатывать сообщение пользователя с анализом', async () => {
      const characterId = 1;
      const userId = 123;
      const messageText = 'Привет!';
      const messageId = 456;
      const mockAnalysis: MessageAnalysis = {
        urgency: 0.5,
        userIntent: 'casual_talk',
        needsImpact: { communication: 0.8 },
        emotionalAnalysis: {
          userMood: 'positive',
          emotionalIntensity: 0.7,
          triggerEmotions: ['happiness'],
          expectedEmotionalResponse: 'positive',
        },
        manipulationAnalysis: {
          userVulnerability: 0.1,
          applicableTechniques: [],
          riskLevel: 'low',
          recommendedIntensity: 0.1,
        },
        specializationAnalysis: {
          responseComplexityLevel: 'simple',
          requiredKnowledge: [],
          domain: 'general',
        },
        behaviorAnalysis: {
          interactionType: 'casual',
          conversationDirection: 'continue',
          userIntent: 'greeting',
          keyTopics: ['greeting'],
        },
        analysisMetadata: {
          confidence: 0.9,
          processingTime: Date.now(),
          llmProvider: 'test',
          analysisVersion: '1.0.0',
          timestamp: new Date(),
        },
      };

      mockMessageBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockMemoryService.createMemory.mockResolvedValue({} as any);

      await service.processUserMessageWithAnalysis(
        characterId,
        userId,
        messageText,
        mockAnalysis,
        messageId,
      );

      expect(mockMessageBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
        characterId,
        userId,
        messageText,
        mockAnalysis,
        messageId,
      );
    });
  });

  describe('getBehaviorContextForResponse', () => {
    it('должен возвращать контекст поведения для ответа', async () => {
      const characterId = 1;
      const mockEmotionalState = { mood: 'happy', intensity: 0.8 };
      const _mockMotivations = [
        {
          id: 1,
          characterId,
          needType: CharacterNeedType.COMMUNICATION,
          intensity: 0.7,
          status: 'active',
          createdAt: new Date(),
        },
      ];
      const mockMemories = [
        {
          id: 1,
          characterId,
          content: 'Test memory',
          importance: 8,
          createdAt: new Date(),
        },
      ];

      mockEmotionalStateService.getEmotionalState.mockResolvedValue(mockEmotionalState as any);
      mockNeedsService.getActiveNeeds.mockResolvedValue([
        {
          id: 1,
          type: CharacterNeedType.COMMUNICATION,
          currentValue: 70,
          threshold: 60,
          lastUpdated: new Date(),
        },
      ] as any);
      mockActionExecutorService.isPerformingAction.mockReturnValue(false);
      mockActionExecutorService.getCurrentAction.mockReturnValue(null);
      mockMemoryRepository.find.mockResolvedValue(mockMemories as any);

      const context = await service.getBehaviorContextForResponse(characterId);

      expect(context).toBeDefined();
      expect(context.emotionalState).toEqual(mockEmotionalState);
      expect(context.motivations).toHaveLength(1);
      expect(context.currentAction).toBeNull();
      expect(context.recentMemories).toEqual(mockMemories);
    });
  });

  describe('analyzeFrustration', () => {
    it('должен анализировать фрустрацию персонажа', async () => {
      const characterId = 1;

      mockEmotionalBehaviorService.analyzeFrustration.mockResolvedValue('mild' as any);

      await service.analyzeFrustration(characterId);

      expect(mockEmotionalBehaviorService.analyzeFrustration).toHaveBeenCalledWith(characterId);
    });
  });

  describe('getFrustrationLevel', () => {
    it('должен возвращать уровень фрустрации', () => {
      const characterId = 1;
      const mockFrustrationLevel = 'medium';

      mockEmotionalBehaviorService.getFrustrationLevel.mockReturnValue(mockFrustrationLevel as any);

      const result = service.getFrustrationLevel(characterId);

      expect(result).toBe(mockFrustrationLevel);
      expect(mockEmotionalBehaviorService.getFrustrationLevel).toHaveBeenCalledWith(characterId);
    });
  });

  describe('determineBehaviorPattern', () => {
    it('должен определять паттерн поведения', async () => {
      const characterId = 1;

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockNeedsService.getActiveNeeds.mockResolvedValue([]);
      mockEmotionalStateService.getEmotionalState.mockResolvedValue(null);
      mockEmotionalBehaviorService.analyzeFrustration.mockResolvedValue('mild' as any);
      mockEmotionalBehaviorService.getActiveFrustrationPatterns.mockReturnValue([]);

      const result = await service.determineBehaviorPattern(characterId);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.description).toBeDefined();
    });
  });

  describe('processIncomingMessage', () => {
    it('должен обрабатывать входящее сообщение', async () => {
      const characterId = 1;
      const message = 'Тестовое сообщение';
      const mockResponse = {
        text: 'Ответ персонажа',
        analysis: {
          urgency: 0.5,
          userIntent: 'unknown' as any,
          needsImpact: {},
          emotionalAnalysis: {
            userMood: 'neutral' as any,
            emotionalIntensity: 0.5,
            triggerEmotions: [],
            expectedEmotionalResponse: 'neutral',
          },
          manipulationAnalysis: {
            userVulnerability: 0.1,
            applicableTechniques: [],
            riskLevel: 'low' as any,
            recommendedIntensity: 0.1,
          },
          specializationAnalysis: {
            responseComplexityLevel: 'simple' as any,
            requiredKnowledge: [],
            domain: 'general',
          },
          behaviorAnalysis: {
            interactionType: 'casual' as any,
            conversationDirection: 'continue' as any,
            userIntent: 'unknown' as any,
            keyTopics: [],
          },
          analysisMetadata: {
            confidence: 0.5,
            processingTime: Date.now(),
            llmProvider: 'test',
            analysisVersion: '1.0.0',
            timestamp: new Date(),
          },
        },
        contextUsed: {
          emotionalState: null,
          motivations: [],
          currentAction: null,
          recentMemories: [],
        },
      };

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockMessageBehaviorService.processIncomingMessage.mockResolvedValue(mockResponse);

      const result = await service.processIncomingMessage(characterId, message);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(mockMessageBehaviorService.processIncomingMessage).toHaveBeenCalled();
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки при обработке поведения персонажа', async () => {
      const characterId = 1;

      mockNeedsService.processNeedsGrowth.mockRejectedValue(new Error('Test error'));

      await expect(service.processCharacterBehavior(characterId)).rejects.toThrow();
    });

    it('должен обрабатывать ошибки при анализе сообщения', async () => {
      const characterId = 1;
      const message = 'Тестовое сообщение';

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockMessageAnalysisService.analyzeUserMessage.mockRejectedValue(new Error('Analysis error'));

      await expect(service.processIncomingMessage(characterId, message)).rejects.toThrow();
    });
  });

  describe('конфигурация', () => {
    it('должен использовать значения конфигурации', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('character.behavior.updateInterval', 300);
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'character.behavior.motivationThreshold',
        70,
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('character.behavior.actionChance', 0.3);
      expect(mockConfigService.get).toHaveBeenCalledWith('character.maxMemorySize', 100);
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'character.behavior.defaultMemoryImportance',
        5,
      );
    });
  });
});
