import { Test, TestingModule } from '@nestjs/testing';
import { MessageProcessingCoordinator } from '../../../src/character/services/core/message-processing-coordinator.service';
import { MessageAnalysisService } from '../../../src/character/services/analysis/message-analysis.service';
import { NeedsService } from '../../../src/character/services/core/needs.service';
import { CharacterBehaviorService } from '../../../src/character/services/behavior/character-behavior.service';
import { CharacterResponseService } from '../../../src/character/services/core/character-response.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { ManipulationService } from '../../../src/character/services/manipulation/manipulation.service';
import { LogService } from '../../../src/logging/log.service';
import { Character } from '../../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { MessageAnalysis } from '../../../src/character/interfaces/analysis.interfaces';
import { MockLogService } from '../../../lib/tester/mocks/log.service.mock';

describe('MessageProcessingCoordinator', () => {
  let service: MessageProcessingCoordinator;
  let mockLogService: MockLogService;
  let mockMessageAnalysisService: jest.Mocked<MessageAnalysisService>;
  let mockNeedsService: jest.Mocked<NeedsService>;
  let mockCharacterBehaviorService: jest.Mocked<CharacterBehaviorService>;
  let mockCharacterResponseService: jest.Mocked<CharacterResponseService>;
  let mockEmotionalStateService: jest.Mocked<EmotionalStateService>;
  let mockManipulationService: jest.Mocked<ManipulationService>;
  let testCharacter: Character;

  const mockAnalysis: MessageAnalysis = {
    urgency: 0.3,
    userIntent: 'casual_talk',
    emotionalAnalysis: {
      expectedEmotionalResponse: 'happy',
      emotionalIntensity: 7,
      triggerEmotions: ['joy', 'excitement'],
      userMood: 'positive',
    },
    needsImpact: {
      [CharacterNeedType.COMMUNICATION]: 5,
      [CharacterNeedType.ATTENTION]: 3,
    },
    manipulationAnalysis: {
      userVulnerability: 0.2,
      applicableTechniques: ['compliment'],
      riskLevel: 'low',
      recommendedIntensity: 0.3,
    },
    specializationAnalysis: {
      responseComplexityLevel: 'simple',
      requiredKnowledge: ['basic_conversation'],
      domain: 'casual_chat',
    },
    behaviorAnalysis: {
      interactionType: 'casual',
      conversationDirection: 'continue',
      userIntent: 'greeting',
      keyTopics: ['greeting', 'wellbeing'],
    },
    analysisMetadata: {
      timestamp: new Date(),
      confidence: 0.85,
      processingTime: 150,
      llmProvider: 'test-provider',
      analysisVersion: '1.0.0',
    },
  };

  beforeEach(async () => {
    mockLogService = new MockLogService();

    mockMessageAnalysisService = {
      analyzeUserMessage: jest.fn(),
    } as any;

    mockNeedsService = {
      updateNeed: jest.fn(),
    } as any;

    mockCharacterBehaviorService = {
      processUserMessageWithAnalysis: jest.fn(),
    } as any;

    mockCharacterResponseService = {
      generateResponse: jest.fn(),
    } as any;

    mockEmotionalStateService = {
      updateEmotionalState: jest.fn(),
    } as any;

    mockManipulationService = {
      applyTechnique: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageProcessingCoordinator,
        { provide: LogService, useValue: mockLogService },
        { provide: MessageAnalysisService, useValue: mockMessageAnalysisService },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: CharacterBehaviorService, useValue: mockCharacterBehaviorService },
        { provide: CharacterResponseService, useValue: mockCharacterResponseService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: ManipulationService, useValue: mockManipulationService },
      ],
    }).compile();

    service = module.get<MessageProcessingCoordinator>(MessageProcessingCoordinator);

    // Создаем тестового персонажа
    testCharacter = new Character();
    testCharacter.id = 1;
    testCharacter.name = 'Test Character';
    testCharacter.archetype = CharacterArchetype.COMPANION;
    testCharacter.biography = 'Test character biography';
    testCharacter.appearance = 'Test character appearance';
    testCharacter.personality = {
      traits: ['friendly', 'helpful'],
      hobbies: ['reading'],
      fears: ['loneliness'],
      values: ['kindness'],
      musicTaste: ['pop'],
      strengths: ['empathy'],
      weaknesses: ['sensitivity'],
    };
    testCharacter.isActive = true;
    testCharacter.createdAt = new Date();
    testCharacter.updatedAt = new Date();
    testCharacter.age = 25;
    testCharacter.energy = 100;
  });

  describe('processUserMessage', () => {
    it('должен успешно обработать сообщение пользователя', async () => {
      const userMessage = 'Привет! Как дела?';
      const userId = 123;
      const recentMessages = ['Как дела?', 'Что нового?'];

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue(
        'Привет! У меня все отлично!',
      );

      const result = await service.processUserMessage(
        testCharacter,
        userId,
        userMessage,
        recentMessages,
      );

      expect(result).toBeDefined();
      expect(result.analysis).toEqual(mockAnalysis);
      expect(result.response).toBe('Привет! У меня все отлично!');
      expect(result.userMessageId).toBeNull();

      // Проверяем, что все сервисы были вызваны
      expect(mockMessageAnalysisService.analyzeUserMessage).toHaveBeenCalledWith(
        testCharacter,
        userMessage,
        recentMessages,
      );
      expect(mockNeedsService.updateNeed).toHaveBeenCalledTimes(2); // Два воздействия на потребности
      expect(mockEmotionalStateService.updateEmotionalState).toHaveBeenCalledWith(
        testCharacter.id,
        mockAnalysis,
      );
      expect(mockCharacterBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
        testCharacter.id,
        userId,
        userMessage,
        mockAnalysis,
      );
      expect(mockCharacterResponseService.generateResponse).toHaveBeenCalledWith(
        testCharacter,
        userMessage,
        expect.arrayContaining([{ role: 'user', content: userMessage }]),
        expect.objectContaining({
          primary: mockAnalysis.emotionalAnalysis.expectedEmotionalResponse,
          intensity: expect.any(Number),
        }),
        expect.stringContaining('Анализ поведения:'),
      );
    });

    it('должен обработать строковый userId', async () => {
      const userMessage = 'Привет!';
      const userId = '123';

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(mockCharacterBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
        testCharacter.id,
        123, // Должен быть преобразован в число
        userMessage,
        mockAnalysis,
      );
    });

    it('должен обработать сообщение без recentMessages', async () => {
      const userMessage = 'Привет!';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(mockMessageAnalysisService.analyzeUserMessage).toHaveBeenCalledWith(
        testCharacter,
        userMessage,
        undefined,
      );
    });

    it('должен обработать ошибки при обновлении потребностей', async () => {
      const userMessage = 'Привет!';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockRejectedValue(new Error('Ошибка обновления потребности'));
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(result.response).toBe('Привет!');
      // Проверяем, что ошибка была залогирована
      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка обновления потребностей персонажа'),
        expect.any(Object),
      );
    });

    it('должен обработать ошибки при обновлении эмоционального состояния', async () => {
      const userMessage = 'Привет!';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockRejectedValue(
        new Error('Ошибка обновления эмоций'),
      );
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(result.response).toBe('Привет!');
      // Проверяем, что ошибка была залогирована
      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка обновления эмоционального состояния персонажа'),
        expect.any(Object),
      );
    });

    it('должен обработать ошибки при обновлении поведенческих паттернов', async () => {
      const userMessage = 'Привет!';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockRejectedValue(
        new Error('Ошибка обновления поведения'),
      );
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(result.response).toBe('Привет!');
      // Проверяем, что ошибка была залогирована
      expect(mockLogService.winstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка обновления поведенческих паттернов персонажа'),
        expect.any(Object),
      );
    });

    it('должен обработать анализ без воздействия на потребности', async () => {
      const userMessage = 'Привет!';
      const userId = 123;
      const analysisWithoutNeeds = {
        ...mockAnalysis,
        needsImpact: {}, // Пустой объект воздействий
      };

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(analysisWithoutNeeds);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      // Проверяем, что updateNeed не был вызван
      expect(mockNeedsService.updateNeed).not.toHaveBeenCalled();
    });

    it('должен обработать анализ с нулевым воздействием на потребности', async () => {
      const userMessage = 'Привет!';
      const userId = 123;
      const analysisWithZeroImpact = {
        ...mockAnalysis,
        needsImpact: {
          [CharacterNeedType.COMMUNICATION]: 0, // Нулевое воздействие
          [CharacterNeedType.ATTENTION]: 3,
        },
      };

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(analysisWithZeroImpact);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      // Проверяем, что updateNeed был вызван только для ATTENTION (impact > 0)
      expect(mockNeedsService.updateNeed).toHaveBeenCalledTimes(1);
      expect(mockNeedsService.updateNeed).toHaveBeenCalledWith(testCharacter.id, {
        type: CharacterNeedType.ATTENTION,
        change: 3,
        reason: 'Анализ сообщения пользователя',
      });
    });

    it('должен обработать общую ошибку в processUserMessage', async () => {
      const userMessage = 'Привет!';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockRejectedValue(
        new Error('Ошибка анализа сообщения'),
      );

      await expect(service.processUserMessage(testCharacter, userId, userMessage)).rejects.toThrow(
        'Ошибка анализа сообщения',
      );
    });
  });

  describe('edge cases', () => {
    it('должен обработать некорректный строковый userId', async () => {
      const userMessage = 'Привет!';
      const userId = 'invalid_number';

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Привет!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(mockCharacterBehaviorService.processUserMessageWithAnalysis).toHaveBeenCalledWith(
        testCharacter.id,
        NaN, // Результат parseInt('invalid_number', 10)
        userMessage,
        mockAnalysis,
      );
    });

    it('должен обработать пустое сообщение', async () => {
      const userMessage = '';
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Не понимаю...');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(result.response).toBe('Не понимаю...');
    });

    it('должен обработать очень длинное сообщение', async () => {
      const userMessage = 'A'.repeat(10000);
      const userId = 123;

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue('Понял!');

      const result = await service.processUserMessage(testCharacter, userId, userMessage);

      expect(result).toBeDefined();
      expect(result.response).toBe('Понял!');
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл обработки сообщения', async () => {
      const userMessage = 'Привет! Как дела? Что нового?';
      const userId = 123;
      const recentMessages = ['Как дела?', 'Что нового?'];

      mockMessageAnalysisService.analyzeUserMessage.mockResolvedValue(mockAnalysis);
      mockNeedsService.updateNeed.mockResolvedValue({} as any);
      mockEmotionalStateService.updateEmotionalState.mockResolvedValue(undefined);
      mockCharacterBehaviorService.processUserMessageWithAnalysis.mockResolvedValue(undefined);
      mockCharacterResponseService.generateResponse.mockResolvedValue(
        'Привет! У меня все отлично, спасибо за вопрос!',
      );

      const result = await service.processUserMessage(
        testCharacter,
        userId,
        userMessage,
        recentMessages,
      );

      expect(result).toBeDefined();
      expect(result.analysis).toEqual(mockAnalysis);
      expect(result.response).toBe('Привет! У меня все отлично, спасибо за вопрос!');

      // Проверяем, что все методы были вызваны
      expect(mockMessageAnalysisService.analyzeUserMessage).toHaveBeenCalled();
      expect(mockNeedsService.updateNeed).toHaveBeenCalled();
      expect(mockEmotionalStateService.updateEmotionalState).toHaveBeenCalled();
      expect(mockCharacterResponseService.generateResponse).toHaveBeenCalled();
    });
  });
});
