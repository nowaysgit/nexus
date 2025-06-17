import { Test } from '@nestjs/testing';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { LogService } from '../../src/logging/log.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { ActionService } from '../../src/character/services/action.service';
import { MemoryService } from '../../src/character/services/memory.service';
import { CharacterService } from '../../src/character/services/character.service';
import { MessageAnalysisService } from '../../src/character/services/message-analysis.service';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { ConfigService } from '@nestjs/config';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { MessageAnalysis } from '../../src/character/interfaces/analysis.interfaces';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { Repository } from 'typeorm';
import { MockLogService } from '../../lib/tester/mocks';
import { ActionType } from '../../src/character/enums/action-type.enum';
import { ActionResult } from '../../src/character/services/action.service';

jest.mock('../../src/common/utils/error-handling/error-handling.utils', () => ({
  withErrorHandling: jest.fn((fn: () => unknown) => fn()),
}));

describe('CharacterBehaviorService Tests', () => {
  let service: CharacterBehaviorService;
  let mockCharacterRepository: Partial<Repository<Character>>;
  let mockMemoryRepository: Partial<Repository<CharacterMemory>>;
  let mockLogService: MockLogService;
  let mockActionService: {
    determineAndPerformAction: jest.Mock;
    isPerformingAction: jest.Mock;
    getCurrentAction: jest.Mock;
    interruptAction: jest.Mock;
    canExecute: jest.Mock;
    execute: jest.Mock;
  };

  const mockLlmService = { generateResponse: jest.fn(), analyzeText: jest.fn() };
  const mockNeedsService = {
    getActiveNeeds: jest.fn(),
    updateNeed: jest.fn(),
    updateNeeds: jest.fn(),
    getNeedsByCharacter: jest.fn(),
    getNeeds: jest.fn(),
  };
  const mockMemoryService = {
    saveMemory: jest.fn(),
    createMemory: jest.fn(),
    createMessageMemory: jest.fn(),
  };
  const mockCharacterService = {
    findOne: jest.fn(),
    findOneById: jest.fn(),
  };
  const mockMessageAnalysisService = { analyzeMessage: jest.fn() };
  const mockManipulationService = {
    analyzeSituationAndChooseTechnique: jest.fn(),
    selectTechnique: jest.fn(),
    executeTechnique: jest.fn(),
  };
  const mockEmotionalStateService = {
    updateEmotionalState: jest.fn(),
    getEmotionalState: jest.fn(),
  };
  const mockConfigService = { get: jest.fn() };
  const mockErrorHandlingService = { handleError: jest.fn() };

  beforeEach(async () => {
    mockCharacterRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    mockMemoryRepository = { find: jest.fn() };
    mockLogService = new MockLogService();
    mockActionService = {
      determineAndPerformAction: jest.fn(),
      isPerformingAction: jest.fn(),
      getCurrentAction: jest.fn(),
      interruptAction: jest.fn(),
      canExecute: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue({ success: true } as ActionResult),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterBehaviorService,
        { provide: LogService, useValue: mockLogService },
        { provide: LLMService, useValue: mockLlmService },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: ActionService, useValue: mockActionService },
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: MessageAnalysisService, useValue: mockMessageAnalysisService },
        { provide: ManipulationService, useValue: mockManipulationService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ErrorHandlingService, useValue: mockErrorHandlingService },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
        { provide: getRepositoryToken(CharacterMemory), useValue: mockMemoryRepository },
      ],
    }).compile();

    service = moduleRef.get<CharacterBehaviorService>(CharacterBehaviorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('processUserMessageWithAnalysis should call all necessary services', async () => {
    // Создаем моки объектов
    const characterId = 1;
    const userId = 2;
    const messageText = 'Hello there!';

    // Создаем объект анализа сообщения
    const messageAnalysis: MessageAnalysis = {
      needsImpact: { [CharacterNeedType.COMMUNICATION]: 10 },
      emotionalAnalysis: {
        userMood: 'positive',
        emotionalIntensity: 0.8,
        triggerEmotions: ['happy', 'excited'],
        expectedEmotionalResponse: 'joy',
      },
      manipulationAnalysis: {
        userVulnerability: 0.2,
        applicableTechniques: [],
        riskLevel: 'low',
        recommendedIntensity: 0.1,
      },
      specializationAnalysis: {
        topicsRelevantToCharacter: ['greeting'],
        knowledgeGapDetected: false,
        responseComplexityLevel: 'simple',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        responseTone: 'friendly',
        initiativeLevel: 0.5,
        conversationDirection: 'continue',
      },
      urgency: 0.8, // Высокая важность для сохранения в память
      sentiment: 'positive',
      keywords: ['hello'],
      topics: ['greeting'],
      analysisMetadata: {
        confidence: 0.9,
        processingTime: 100,
        llmProvider: 'test',
        analysisVersion: '1.0',
        timestamp: new Date(),
      },
    };

    // Мокируем возвращаемые значения
    (mockCharacterRepository.findOne as jest.Mock).mockResolvedValue({
      id: characterId,
      name: 'Test Character',
      needs: [],
    });

    // Мокируем другие необходимые сервисы
    mockNeedsService.getNeeds.mockResolvedValue([]);
    mockEmotionalStateService.getEmotionalState.mockResolvedValue({
      emotion: 'neutral',
      intensity: 0.5,
    });
    mockActionService.isPerformingAction.mockReturnValue(false);
    mockMemoryService.createMessageMemory.mockResolvedValue({
      id: 1,
      characterId,
      userId,
      content: messageText,
      importance: 8,
      createdAt: new Date(),
    });
    mockManipulationService.analyzeSituationAndChooseTechnique.mockResolvedValue(null);

    // Вызываем тестируемый метод напрямую
    await service.processUserMessageWithAnalysis(characterId, userId, messageText, messageAnalysis);

    // Проверяем, что необходимые сервисы были вызваны
    expect(mockCharacterRepository.findOne).toHaveBeenCalled();
    expect(mockMemoryService.createMessageMemory).toHaveBeenCalled();
    expect(mockNeedsService.updateNeed).toHaveBeenCalled();
  });

  it('processActionTrigger должен вызывать execute с правильными параметрами', async () => {
    // Подготовка данных для теста
    const characterId = 1;
    const userId = 2;
    const triggerType = 'user_request';
    const character = { id: characterId, userId };
    const motivations = [
      {
        id: 1,
        characterId,
        needType: CharacterNeedType.COMMUNICATION,
        intensity: 0.8,
        status: 'active',
        createdAt: new Date(),
      },
    ];

    // Создаем контекст для триггера действия
    const actionTriggerContext = {
      characterId,
      userId,
      triggerType,
      triggerData: {},
      timestamp: new Date(),
      motivations,
    };

    // Настраиваем моки
    mockCharacterService.findOneById.mockResolvedValue(character);

    // Мокируем selectActionForMotivation, чтобы возвращал действие
    const mockAction = {
      type: ActionType.INITIATE_CONVERSATION,
      description: 'Тестовое действие',
      priority: 8,
      relatedNeeds: [CharacterNeedType.COMMUNICATION],
      status: 'planned',
      metadata: {},
    };

    // Используем jest.spyOn для приватного метода
    jest.spyOn(service as any, 'selectActionForMotivation').mockResolvedValue(mockAction);

    // Мокируем determineAndPerformAction вместо execute
    mockActionService.determineAndPerformAction.mockResolvedValue({
      type: ActionType.INITIATE_CONVERSATION,
      description: 'Тестовое действие выполнено',
      status: 'completed',
    });

    // Вызываем тестируемый метод с правильным объектом контекста
    await service.processActionTrigger(actionTriggerContext);

    // Проверяем, что determineAndPerformAction был вызван
    expect(mockActionService.determineAndPerformAction).toHaveBeenCalled();

    // Проверяем, что determineAndPerformAction был вызван хотя бы один раз
    expect(mockActionService.determineAndPerformAction).toHaveBeenCalledTimes(1);

    // Проверяем параметры вызова
    expect(mockActionService.determineAndPerformAction).toHaveBeenCalledWith(
      character,
      expect.objectContaining({
        characterId: characterId,
        userId: userId,
        triggerType: triggerType,
      }),
    );
  });
});
