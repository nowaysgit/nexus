import { MessageProcessingCoordinator } from '../../src/character/services/message-processing-coordinator.service';
import { Character } from '../../src/character/entities/character.entity';
import { MessageAnalysis } from '../../src/character/interfaces/analysis.interfaces';
import { createTestSuite, createTest } from '../../lib/tester/test-suite';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

// Расширяем тип результата для тестов
interface ProcessUserMessageResult {
  analysis?: MessageAnalysis;
  response: string;
  userMessageId?: number;
  error?: Error;
}

createTestSuite('MessageProcessingCoordinator Tests', () => {
  let service: MessageProcessingCoordinator;
  let mockMessageAnalysisService: {
    analyzeUserMessage: jest.Mock;
  };
  let mockNeedsService: {
    updateNeed: jest.Mock;
  };
  let mockCharacterBehaviorService: {
    processUserMessageWithAnalysis: jest.Mock;
  };
  let mockCharacterResponseService: {
    generateResponse: jest.Mock;
  };
  let mockEmotionalStateService: {
    updateEmotionalState: jest.Mock;
  };
  let mockManipulationService: {
    analyzeSituationAndChooseTechnique: jest.Mock;
  };
  let mockLogService: MockLogService;

  beforeEach(async () => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Настройка моков с динамическими возвращаемыми значениями
    mockMessageAnalysisService = {
      analyzeUserMessage: jest.fn().mockResolvedValue({
        needsImpact: {
          общение: 10,
          развлечение: 5,
        },
        sentiment: 'positive',
        keywords: ['привет', 'дела'],
        topics: ['приветствие'],
        urgency: 0.5,
        behaviorAnalysis: {
          interactionType: 'casual',
          conversationDirection: 'continue',
          responseTone: 'дружелюбный',
          initiativeLevel: 0.6,
        },
        emotionalAnalysis: {
          userMood: 'positive',
          triggerEmotions: ['радость', 'интерес'],
          expectedEmotionalResponse: 'радость',
          emotionalIntensity: 0.7,
        },
        manipulationAnalysis: {
          userVulnerability: 0.3,
          applicableTechniques: ['комплимент'],
          recommendedIntensity: 0.2,
          riskLevel: 'low',
        },
        specializationAnalysis: {
          topicsRelevantToCharacter: ['общение'],
          knowledgeGapDetected: false,
          responseComplexityLevel: 'simple',
        },
        analysisMetadata: {
          timestamp: new Date(),
          processingTime: 150,
          confidence: 0.9,
          llmProvider: 'gpt-4',
          analysisVersion: '1.0',
        },
      }),
    };

    mockNeedsService = {
      updateNeed: jest.fn().mockResolvedValue(undefined),
    };

    mockCharacterBehaviorService = {
      processUserMessageWithAnalysis: jest.fn().mockResolvedValue(undefined),
    };

    mockCharacterResponseService = {
      generateResponse: jest
        .fn()
        .mockResolvedValue('Привет! У меня отличное настроение! А у тебя как дела?'),
    };

    mockEmotionalStateService = {
      updateEmotionalState: jest.fn().mockResolvedValue(undefined),
    };

    mockManipulationService = {
      analyzeSituationAndChooseTechnique: jest.fn().mockResolvedValue(undefined),
    };

    mockLogService = new MockLogService();

    // Создаем моки для новых зависимостей
    const _mockCharacterRepository = {
      findOne: jest.fn(),
    };

    const _mockEventEmitter = {
      emit: jest.fn(),
    };

    // Создаем сервис напрямую с моками
    service = new MessageProcessingCoordinator(
      mockMessageAnalysisService as any,
      mockNeedsService as any,
      mockCharacterBehaviorService as any,
      mockCharacterResponseService as any,
      mockEmotionalStateService as any,
      mockManipulationService as any,
      mockLogService as any,
    );
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
    mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
    mockNeedsService.updateNeed.mockResolvedValue(undefined);
    mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
    mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
    mockManipulationService.analyzeSituationAndChooseTechnique.mockResolvedValue('комплимент');
    mockCharacterResponseService.generateResponse.mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат
    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.analysis.needsImpact).toEqual(mockAnalysis.needsImpact);
    expect(result.analysis.sentiment).toBe(mockAnalysis.sentiment);
    expect(result.analysis.analysisMetadata.timestamp).toBeInstanceOf(Date);
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
      result.analysis,
    );
    expect(mockEmotionalStateService.updateEmotionalState).toHaveBeenCalledWith(1, result.analysis);
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

    // Создаем spy для error метода
    const errorSpy = jest.spyOn(mockLogService, 'error');

    // Настройка мока для ошибки
    const analysisError = new Error('Ошибка анализа сообщения');
    mockMessageAnalysisService.analyzeUserMessage.mockRejectedValue(analysisError);

    // withErrorHandling оборачивает ошибки, поэтому ожидаем отклонение промиса
    await expect(
      service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', ['Предыдущее сообщение']),
    ).rejects.toThrow('Ошибка анализа сообщения');

    // Проверяем, что ошибка была залогирована
    expect(errorSpy).toHaveBeenCalled();
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

    // Создаем spy для error метода
    const errorSpy = jest.spyOn(mockLogService, 'error');

    // Настройка моков - ошибка в needs service должна логироваться но не прерывать процесс
    mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
    mockNeedsService.updateNeed.mockRejectedValue(new Error('Needs service error'));
    mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
    mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
    mockManipulationService.analyzeSituationAndChooseTechnique.mockResolvedValue('комплимент');
    mockCharacterResponseService.generateResponse.mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат - сервис должен продолжить работу несмотря на ошибку
    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.analysis.needsImpact).toEqual(mockAnalysis.needsImpact);
    expect(result.analysis.sentiment).toBe(mockAnalysis.sentiment);
    expect(result.analysis.analysisMetadata.timestamp).toBeInstanceOf(Date);
    expect(result.response).toBe('Привет! У меня отличное настроение! А у тебя как дела?');

    // Ошибка в needs service логируется, но не прерывает процесс
    expect(errorSpy).toHaveBeenCalledWith(
      'Ошибка обновления потребностей персонажа',
      expect.objectContaining({
        error: 'Needs service error',
        characterId: 1,
      }),
    );
  });

  createTest({ name: 'should handle character behavior service error gracefully' }, async () => {
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

    // Создаем spy для error метода
    const errorSpy = jest.spyOn(mockLogService, 'error');

    // Настройка моков
    mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
    mockNeedsService.updateNeed.mockResolvedValue(undefined);
    mockCharacterBehaviorService.processUserMessageWithAnalysis.mockRejectedValue(
      new Error('Character behavior error'),
    );
    mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
    mockManipulationService.analyzeSituationAndChooseTechnique.mockResolvedValue('комплимент');
    mockCharacterResponseService.generateResponse.mockResolvedValue(
      'Привет! У меня отличное настроение! А у тебя как дела?',
    );

    const result = (await service.processUserMessage(mockCharacter, 456, 'Привет! Как дела?', [
      'Предыдущее сообщение',
    ])) as ProcessUserMessageResult;

    // Проверяем результат - сервис должен продолжить работу несмотря на ошибку
    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.analysis.needsImpact).toEqual(mockAnalysis.needsImpact);
    expect(result.analysis.sentiment).toBe(mockAnalysis.sentiment);
    expect(result.analysis.analysisMetadata.timestamp).toBeInstanceOf(Date);
    expect(result.response).toBe('Привет! У меня отличное настроение! А у тебя как дела?');

    // Ошибка в behavior service логируется, но не прерывает процесс
    expect(errorSpy).toHaveBeenCalledWith(
      'Ошибка обновления поведенческих паттернов персонажа',
      expect.objectContaining({
        error: 'Character behavior error',
        characterId: 1,
      }),
    );
  });
});
