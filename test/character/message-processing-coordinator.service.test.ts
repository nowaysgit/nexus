import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { createTestSuite, createTest } from '../../lib/tester';
import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { MessageAnalysisService } from '../../src/character/services/message-analysis.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { CharacterBehaviorService } from '../../src/character/services/character-behavior.service';
import { CharacterResponseService } from '../../src/character/services/character-response.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { LogService } from '../../src/logging/log.service';
import { Character } from '../../src/character/entities/character.entity';
import { MessageAnalysis } from '../../src/character/interfaces/analysis.interfaces';

// Расширяем тип результата для тестов
interface ProcessUserMessageResult {
  analysis?: MessageAnalysis;
  response: string;
  userMessageId?: number;
  error?: Error;
}

createTestSuite('MessageProcessingCoordinator Tests', () => {
  let service: MessageProcessingCoordinator;
  let mockMessageAnalysisService: Partial<MessageAnalysisService>;
  let mockNeedsService: Partial<NeedsService>;
  let mockCharacterBehaviorService: Partial<CharacterBehaviorService>;
  let mockCharacterResponseService: Partial<CharacterResponseService>;
  let mockEmotionalStateService: Partial<EmotionalStateService>;
  let mockManipulationService: Partial<ManipulationService>;
  let mockLogService: Partial<LogService>;
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;

  beforeEach(async () => {
    // Создаем моки для зависимостей
    mockMessageAnalysisService = {
      analyzeUserMessage: jest.fn(),
    };

    mockNeedsService = {
      updateNeed: jest.fn(),
    };

    mockCharacterBehaviorService = {
      processUserMessageWithAnalysis: jest.fn(),
    };

    mockCharacterResponseService = {
      generateResponse: jest.fn(),
    };

    mockEmotionalStateService = {
      updateEmotionalState: jest.fn(),
    };

    mockManipulationService = {
      analyzeSituationAndChooseTechnique: jest.fn(),
    };

    mockLogService = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      verbose: jest.fn(),
    };

    moduleRef = await TestModuleBuilder.create()
      .withProviders([
        MessageProcessingCoordinator,
        { provide: MessageAnalysisService, useValue: mockMessageAnalysisService },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: CharacterBehaviorService, useValue: mockCharacterBehaviorService },
        { provide: CharacterResponseService, useValue: mockCharacterResponseService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: ManipulationService, useValue: mockManipulationService },
        { provide: LogService, useValue: mockLogService },
      ])
      .withRequiredMocks()
      .compile();

    service = moduleRef.get<MessageProcessingCoordinator>(MessageProcessingCoordinator);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    jest.clearAllMocks();
  });

  createTest({ name: 'should be defined' }, async () => {
    expect(service).toBeDefined();
  });

  createTest({ name: 'should process user message successfully' }, async () => {
    const mockCharacter: Character = {
      id: 1,
      name: 'Тест Персонаж',
      biography: 'Тестовая биография',
      personality: { traits: ['friendly'] },
    } as Character;

    const mockAnalysis: MessageAnalysis = {
      needsImpact: {
        общение: 10,
        развлечение: 5,
      },
      emotionalAnalysis: {
        userMood: 'positive',
        emotionalIntensity: 0.7,
        triggerEmotions: ['радость', 'интерес'],
        expectedEmotionalResponse: 'радость',
      },
      manipulationAnalysis: {
        userVulnerability: 0.3,
        applicableTechniques: ['комплимент'],
        riskLevel: 'low',
        recommendedIntensity: 0.2,
      },
      specializationAnalysis: {
        topicsRelevantToCharacter: ['общение'],
        knowledgeGapDetected: false,
        responseComplexityLevel: 'simple',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        responseTone: 'дружелюбный',
        initiativeLevel: 0.6,
        conversationDirection: 'continue',
      },
      urgency: 0.5,
      sentiment: 'positive',
      keywords: ['привет', 'дела'],
      topics: ['приветствие'],
      analysisMetadata: {
        confidence: 0.9,
        processingTime: 150,
        llmProvider: 'gpt-4',
        analysisVersion: '1.0',
        timestamp: new Date(),
      },
    };

    // Настройка моков
    (mockMessageAnalysisService.analyzeUserMessage as jest.Mock).mockResolvedValue(mockAnalysis);
    (mockNeedsService.updateNeed as jest.Mock).mockResolvedValue(undefined);
    (mockCharacterBehaviorService.processUserMessageWithAnalysis as jest.Mock).mockResolvedValue(
      undefined,
    );
    (mockEmotionalStateService.updateEmotionalState as jest.Mock).mockResolvedValue(undefined);
    (mockManipulationService.analyzeSituationAndChooseTechnique as jest.Mock).mockResolvedValue(
      'комплимент',
    );
    (mockCharacterResponseService.generateResponse as jest.Mock).mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат
    expect(result).toBeDefined();
    expect(result.analysis).toEqual(mockAnalysis);
    expect(result.response).toBe('Привет! У меня отличное настроение! А у тебя как дела?');

    // Проверяем вызовы сервисов
    expect(mockMessageAnalysisService.analyzeUserMessage).toHaveBeenCalledWith(
      mockCharacter,
      456,
      'Привет! Как дела?',
      ['Предыдущее сообщение'],
    );
    expect(mockNeedsService.updateNeed).toHaveBeenCalledTimes(2);
    expect(mockCharacterBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
      1,
      456,
      'Привет! Как дела?',
      mockAnalysis,
    );
    expect(mockEmotionalStateService.updateEmotionalState).toHaveBeenCalledWith(1, mockAnalysis);
    expect(mockManipulationService.analyzeSituationAndChooseTechnique).toHaveBeenCalledWith(
      1,
      456,
      'Привет! Как дела?',
    );
    expect(mockCharacterResponseService.generateResponse).toHaveBeenCalled();
  });

  createTest({ name: 'should handle analysis service error gracefully' }, async () => {
    const mockCharacter: Character = {
      id: 1,
      name: 'Тест Персонаж',
      biography: 'Тестовая биография',
      personality: { traits: ['friendly'] },
    } as Character;

    // Настройка моков для имитации ошибки
    (mockMessageAnalysisService.analyzeUserMessage as jest.Mock).mockRejectedValue(
      new Error('Analysis failed'),
    );

    // Проверяем, что ошибка пробрасывается наверх
    await expect(
      service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', ['Предыдущее сообщение']),
    ).rejects.toThrow('Analysis failed');

    expect(mockLogService.error).toHaveBeenCalled();
  });

  createTest({ name: 'should handle needs service error gracefully' }, async () => {
    const mockCharacter: Character = {
      id: 1,
      name: 'Тест Персонаж',
      biography: 'Тестовая биография',
      personality: { traits: ['friendly'] },
    } as Character;

    const mockAnalysis: MessageAnalysis = {
      needsImpact: {
        общение: 10,
        развлечение: 5,
      },
      emotionalAnalysis: {
        userMood: 'positive',
        emotionalIntensity: 0.7,
        triggerEmotions: ['радость', 'интерес'],
        expectedEmotionalResponse: 'радость',
      },
      manipulationAnalysis: {
        userVulnerability: 0.3,
        applicableTechniques: ['комплимент'],
        riskLevel: 'low',
        recommendedIntensity: 0.2,
      },
      specializationAnalysis: {
        topicsRelevantToCharacter: ['общение'],
        knowledgeGapDetected: false,
        responseComplexityLevel: 'simple',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        responseTone: 'дружелюбный',
        initiativeLevel: 0.6,
        conversationDirection: 'continue',
      },
      urgency: 0.5,
      sentiment: 'positive',
      keywords: ['привет', 'дела'],
      topics: ['приветствие'],
      analysisMetadata: {
        confidence: 0.9,
        processingTime: 150,
        llmProvider: 'gpt-4',
        analysisVersion: '1.0',
        timestamp: new Date(),
      },
    };

    // Настройка моков
    (mockMessageAnalysisService.analyzeUserMessage as jest.Mock).mockResolvedValue(mockAnalysis);
    (mockNeedsService.updateNeed as jest.Mock).mockRejectedValue(new Error('Needs update failed'));
    (mockCharacterBehaviorService.processUserMessageWithAnalysis as jest.Mock).mockResolvedValue(
      undefined,
    );
    (mockEmotionalStateService.updateEmotionalState as jest.Mock).mockResolvedValue(undefined);
    (mockManipulationService.analyzeSituationAndChooseTechnique as jest.Mock).mockResolvedValue(
      'комплимент',
    );
    (mockCharacterResponseService.generateResponse as jest.Mock).mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат
    expect(result).toBeDefined();
    expect(result.analysis).toEqual(mockAnalysis);
    expect(result.response).toBe('Привет! У меня отличное настроение! А у тебя как дела?');
    expect(mockLogService.error).toHaveBeenCalled();
  });

  it('should handle character behavior service error gracefully', async () => {
    const mockCharacter: Character = {
      id: 1,
      name: 'Тест Персонаж',
      biography: 'Тестовая биография',
      personality: { traits: ['friendly'] },
    } as Character;

    const mockAnalysis: MessageAnalysis = {
      needsImpact: {
        общение: 10,
        развлечение: 5,
      },
      emotionalAnalysis: {
        userMood: 'positive',
        emotionalIntensity: 0.7,
        triggerEmotions: ['радость', 'интерес'],
        expectedEmotionalResponse: 'радость',
      },
      manipulationAnalysis: {
        userVulnerability: 0.3,
        applicableTechniques: ['комплимент'],
        riskLevel: 'low',
        recommendedIntensity: 0.2,
      },
      specializationAnalysis: {
        topicsRelevantToCharacter: ['общение'],
        knowledgeGapDetected: false,
        responseComplexityLevel: 'simple',
      },
      behaviorAnalysis: {
        interactionType: 'casual',
        responseTone: 'дружелюбный',
        initiativeLevel: 0.6,
        conversationDirection: 'continue',
      },
      urgency: 0.5,
      sentiment: 'positive',
      keywords: ['привет', 'дела'],
      topics: ['приветствие'],
      analysisMetadata: {
        confidence: 0.9,
        processingTime: 150,
        llmProvider: 'gpt-4',
        analysisVersion: '1.0',
        timestamp: new Date(),
      },
    };

    // Настройка моков
    (mockMessageAnalysisService.analyzeUserMessage as jest.Mock).mockResolvedValue(mockAnalysis);
    (mockNeedsService.updateNeed as jest.Mock).mockResolvedValue(undefined);
    (mockCharacterBehaviorService.processUserMessageWithAnalysis as jest.Mock).mockRejectedValue(
      new Error('Behavior processing failed'),
    );
    (mockEmotionalStateService.updateEmotionalState as jest.Mock).mockResolvedValue(undefined);
    (mockManipulationService.analyzeSituationAndChooseTechnique as jest.Mock).mockResolvedValue(
      'комплимент',
    );
    (mockCharacterResponseService.generateResponse as jest.Mock).mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат
    expect(result).toBeDefined();
    expect(result.analysis).toEqual(mockAnalysis);
    expect(result.response).toBe('Привет! У меня отличное настроение! А у тебя как дела?');
    expect(mockLogService.error).toHaveBeenCalled();
  });
});
