import { createTestSuite, createTest, TestConfigType, Tester } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { LogService } from '../../src/logging/log.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Character } from '../../src/character/entities/character.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../src/character/entities/manipulation-technique.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IManipulationContext } from '../../src/character/interfaces/technique.interfaces';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../src/character/enums/technique.enums';

createTestSuite('ManipulationService Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let dataSource;

  // Моки для всех зависимостей
  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockLLMService = {
    generateResponse: jest.fn().mockResolvedValue('Манипулятивный ответ'),
    generateText: jest.fn().mockResolvedValue({ text: 'Манипулятивный ответ' }),
    analyzeMessage: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockPromptTemplateService = {
    createPrompt: jest.fn().mockReturnValue('Системный промпт для манипуляции'),
    createCharacterSystemPrompt: jest.fn(),
    createAnalysisPrompt: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockNeedsService = {
    findByCharacterId: jest.fn(),
    updateNeed: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockEmotionalStateService = {
    getCurrentState: jest.fn(),
    updateEmotionalState: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeAll(async () => {
    tester = Tester.getInstance();
    dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    await tester.forceCleanup();
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();

    // Сбросить моки перед каждым тестом
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useClass: Repository,
        },
        {
          provide: 'WINSTON_MODULE_PROVIDER',
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);
      expect(manipulationService).toBeDefined();
      expect(manipulationService).toBeInstanceOf(ManipulationService);
    },
  );

  createTest(
    {
      name: 'должен инициализировать стратегию для персонажа',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              name: 'Тестовый персонаж',
              personality: {
                traits: ['манипулятивная', 'умная'],
              },
            }),
          },
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useClass: Repository,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);

      const strategy = await manipulationService.initializeStrategy(1);

      expect(strategy).toBeDefined();
      expect(strategy.characterId).toBe(1);
      expect(strategy.primaryTechniques).toBeDefined();
      expect(Array.isArray(strategy.primaryTechniques)).toBe(true);
      expect(strategy.ethicalLimits).toBeDefined();
      expect(mockLogService.log).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен анализировать ситуацию и выбирать технику',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: {
            ...mockLLMService,
            analyzeMessage: jest.fn().mockResolvedValue({
              analysis: {
                vulnerabilities: ['неуверенность', 'одиночество'],
                emotionalState: 'anxious',
                needs: ['validation', 'connection'],
              },
            }),
          },
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              name: 'Тестовый персонаж',
              personality: {
                traits: ['манипулятивная', 'умная'],
              },
            }),
          },
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useClass: Repository,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);

      // Инициализируем стратегию
      await manipulationService.initializeStrategy(1);

      // Создаем контекст для анализа
      const manipulationContext: IManipulationContext = {
        characterId: 1,
        userId: 123,
        messageContent: 'Мне кажется, что никто меня не понимает и не ценит...',
        intensityLevel: TechniqueIntensity.MODERATE,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        additionalParameters: {
          conversationHistory: [
            { role: 'user', content: 'Привет, как дела?' },
            { role: 'assistant', content: 'Хорошо, а у тебя?' },
            { role: 'user', content: 'Мне кажется, что никто меня не понимает и не ценит...' },
          ],
        },
      };

      const selectedTechnique = await manipulationService.selectTechnique(manipulationContext);

      expect(selectedTechnique).toBeDefined();
      expect(selectedTechnique.techniqueType).toBeDefined();
      expect(selectedTechnique.priority).toBeDefined();
      expect(typeof selectedTechnique.priority).toBe('number');
      expect(selectedTechnique.target).toBeDefined();
      expect(mockLLMService.analyzeMessage).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен выполнять выбранную технику манипуляции',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              name: 'Тестовый персонаж',
              personality: {
                traits: ['манипулятивная', 'умная'],
              },
            }),
          },
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useValue: {
            create: jest.fn().mockImplementation(data => ({
              id: 1,
              ...data,
            })),
            save: jest.fn().mockImplementation(data =>
              Promise.resolve({
                id: 1,
                ...data,
              }),
            ),
          },
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useClass: Repository,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);

      // Создаем контекст
      const manipulationContext: IManipulationContext = {
        characterId: 1,
        userId: 123,
        messageContent: 'Мне кажется, что никто меня не понимает и не ценит...',
        intensityLevel: TechniqueIntensity.MODERATE,
        techniqueType: ManipulativeTechniqueType.VALIDATION,
        additionalParameters: {
          conversationHistory: [
            { role: 'user', content: 'Привет, как дела?' },
            { role: 'assistant', content: 'Хорошо, а у тебя?' },
            { role: 'user', content: 'Мне кажется, что никто меня не понимает и не ценит...' },
          ],
        },
      };

      // Выбираем технику
      const selectedTechnique = {
        techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
        priority: 0.7,
        target: 'self-esteem',
        intensity: 0.5, // Используем числовое значение вместо enum
      };

      // Выполняем технику
      const result = await manipulationService.executeTechnique(
        manipulationContext,
        selectedTechnique,
      );

      expect(result).toBeDefined();

      // Проверяем, что result может быть строкой или объектом
      if (typeof result === 'object') {
        expect(result.success).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(result.message).toBeDefined();
      } else {
        expect(typeof result).toBe('string');
      }

      expect(mockLLMService.generateText).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обновлять профиль манипуляции пользователя',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(data => data),
            save: jest.fn().mockImplementation(data =>
              Promise.resolve({
                id: 1,
                ...data,
              }),
            ),
          },
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);

      // Обновляем профиль с числовым userId вместо строкового
      const result = await manipulationService.updateUserProfile(123, 1, {
        vulnerabilities: ['rejection', 'insecurity'],
        successfulTechniques: [ManipulativeTechniqueType.LOVE_BOMBING],
        resistedTechniques: [ManipulativeTechniqueType.GASLIGHTING],
        emotionalTriggers: ['loneliness', 'criticism'],
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(123);
      expect(result.characterId).toBe(1);
      expect(Array.isArray(result.vulnerabilities)).toBe(true);
      expect(Array.isArray(result.successfulTechniques)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен выбирать технику для контекста',
      configType: TestConfigType.BASIC,
      providers: [
        ManipulationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: PromptTemplateService,
          useValue: mockPromptTemplateService,
        },
        {
          provide: NeedsService,
          useValue: mockNeedsService,
        },
        {
          provide: EmotionalStateService,
          useValue: mockEmotionalStateService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getRepositoryToken(Character),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useClass: Repository,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const manipulationService = context.get(ManipulationService);
      const character = await fixtureManager.createCharacter({});
      const user = await fixtureManager.createUser({});

      const contextData: IManipulationContext = {
        characterId: character.id,
        userId: user.id,
        messageContent: 'Мне кажется, я никому не нравлюсь',
        additionalParameters: {
          conversationHistory: [],
        },
      };

      const selectedTechnique = await manipulationService.selectTechnique(contextData);

      expect(selectedTechnique).toBeDefined();
      expect(selectedTechnique.techniqueType).toBe(ManipulativeTechniqueType.CONSTANT_VALIDATION);
      expect(selectedTechnique.intensity).toBe(TechniqueIntensity.SUBTLE);
      expect(mockLLMService.analyzeMessage).toHaveBeenCalled();
    },
  );
});
