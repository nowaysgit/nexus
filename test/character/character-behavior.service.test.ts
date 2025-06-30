import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { LogService } from '../../src/logging/log.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { ActionService } from '../../src/character/services/action.service';
import { ActionExecutorService } from '../../src/character/services/action-executor.service';
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
import { MessageBehaviorService } from '../../src/character/services/message-behavior.service';
import { EmotionalBehaviorService } from '../../src/character/services/emotional-behavior.service';

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
    processActionTrigger: jest.Mock;
  };

  const mockActionExecutorService = {
    determineAndPerformAction: jest.fn(),
    isPerformingAction: jest.fn(),
    getCurrentAction: jest.fn(),
    interruptAction: jest.fn(),
    canExecute: jest.fn(),
    execute: jest.fn(),
    processActionTrigger: jest.fn(),
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
  const mockErrorHandlingService = {
    handleDbError: jest.fn(),
    logError: jest.fn(),
    createErrorContext: jest.fn(),
  };
  const mockMessageBehaviorService = {
    processIncomingMessage: jest.fn().mockResolvedValue({ text: 'Test response' }),
    processUserMessageWithAnalysis: jest.fn(),
  };
  const mockEmotionalBehaviorService = {
    // Add any necessary mock properties for EmotionalBehaviorService
  };

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
      processActionTrigger: jest
        .fn()
        .mockResolvedValue({ success: true, data: { action: { type: ActionType.SEND_MESSAGE } } }),
    };

    // Создаем мок для EventEmitter2
    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterBehaviorService,
        { provide: LogService, useValue: mockLogService },
        { provide: LLMService, useValue: mockLlmService },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: ActionService, useValue: mockActionService },
        { provide: ActionExecutorService, useValue: mockActionExecutorService },
        { provide: ActionExecutorService, useValue: mockActionExecutorService },
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: CharacterService, useValue: mockCharacterService },
        { provide: MessageAnalysisService, useValue: mockMessageAnalysisService },
        { provide: ManipulationService, useValue: mockManipulationService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: MessageBehaviorService, useValue: mockMessageBehaviorService },
        { provide: EmotionalBehaviorService, useValue: mockEmotionalBehaviorService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
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
      primary: 'neutral',
      intensity: 0.5,
      secondary: [],
      modifiers: {},
      timestamp: new Date(),
      characterId: characterId,
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

    // Проверяем, что MessageBehaviorService был вызван
    expect(mockMessageBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
      characterId,
      userId,
      messageText,
      messageAnalysis,
      undefined,
    );
  });

  it('processActionTrigger должен вызывать determineAndPerformAction с правильными параметрами', async () => {
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

    // Мокируем processActionTrigger в ActionService
    mockActionService.processActionTrigger.mockResolvedValue({
      success: true,
      data: {
        action: {
          type: ActionType.INITIATE_CONVERSATION,
          description: 'Тестовое действие выполнено',
          status: 'completed',
        },
        result: { success: true },
      },
    });

    // Вызываем тестируемый метод с правильным объектом контекста
    const result = await service.processActionTrigger(actionTriggerContext);

    // Проверяем, что processActionTrigger был вызван в ActionService
    expect(mockActionService.processActionTrigger).toHaveBeenCalledWith(actionTriggerContext);

    // Проверяем результат
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
