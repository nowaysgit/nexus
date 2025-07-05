import { createTestSuite, createTest } from '../../lib/tester';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { ManipulationService } from '../../src/character/services/manipulation/manipulation.service';
import { NeedsService } from '../../src/character/services/core/needs.service';
import { EmotionalStateService } from '../../src/character/services/core/emotional-state.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { LogService } from '../../src/logging/log.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestingModule } from '@nestjs/testing';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../src/character/enums/technique.enums';
import { IManipulationContext } from '../../src/character/interfaces/technique.interfaces';
import { TechniqueExecutorService } from '../../src/character/services/technique/technique-executor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../src/character/entities/manipulation-technique.entity';

createTestSuite('ManipulationService Tests', () => {
  let manipulationService: ManipulationService;
  let moduleRef: TestingModule;

  // Моки для зависимостей
  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockLLMService = {
    generateText: jest.fn(),
    generateJSON: jest.fn(),
  };

  const mockPromptTemplateService = {
    createPrompt: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  const mockNeedsService = {
    getActiveNeeds: jest.fn(),
  };

  const mockEmotionalStateService = {
    getEmotionalState: jest.fn(),
  };

  const mockTechniqueExecutorService = {
    executeTechnique: jest.fn(),
  };

  const mockCharacterRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Test Character',
      personality: {},
    } as Character),
  };

  const mockTechniqueExecutionRepository = {
    create: jest.fn(
      (dto: Partial<TechniqueExecution>): TechniqueExecution => dto as TechniqueExecution,
    ),
    save: jest.fn(
      (entity: TechniqueExecution): Promise<TechniqueExecution> => Promise.resolve(entity),
    ),
  };

  const mockUserProfileRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(
      (dto: Partial<UserManipulationProfile>): UserManipulationProfile =>
        dto as UserManipulationProfile,
    ),
    save: jest.fn(
      (entity: UserManipulationProfile): Promise<UserManipulationProfile> =>
        Promise.resolve(entity),
    ),
  };

  const mockExistingProfile = {
    id: 1,
    characterId: 1,
    userId: 1,
    vulnerabilities: ['need-for-approval'],
    successfulTechniques: [],
    resistedTechniques: [],
    emotionalTriggers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    getRecommendedIntensity: jest.fn().mockReturnValue(0.5),
    updateEffectiveness: jest.fn(),
    shouldBlockTechnique: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    // Сбрасываем моки перед каждым тестом
    jest.clearAllMocks();

    // Настраиваем мок для findOne, чтобы он возвращал существующий профиль в тесте обновления
    mockUserProfileRepository.findOne.mockResolvedValue(mockExistingProfile);
    // Настраиваем мок для save, чтобы он возвращал полный объект
    mockUserProfileRepository.save.mockImplementation((profile: Partial<UserManipulationProfile>) =>
      Promise.resolve({
        ...mockExistingProfile,
        ...profile,
      } as UserManipulationProfile),
    );

    // Настройка моков
    mockLLMService.generateJSON.mockResolvedValue({
      techniqueType: ManipulativeTechniqueType.LOVE_BOMBING,
      intensity: 0.7,
      priority: 0.8,
      target: 'self-esteem',
    });

    mockNeedsService.getActiveNeeds.mockResolvedValue([
      { type: 'acceptance', currentValue: 30 },
      { type: 'recognition', currentValue: 25 },
    ]);

    mockEmotionalStateService.getEmotionalState.mockResolvedValue({
      currentEmotion: 'neutral',
      intensity: 50,
      valence: 0,
      arousal: 0,
    });

    mockTechniqueExecutorService.executeTechnique.mockResolvedValue({
      success: true,
      message: 'Мокированный ответ манипулятивной техники',
      effectiveness: 85,
      ethicalScore: 70,
    });

    mockPromptTemplateService.createPrompt.mockReturnValue('Мокированный промпт');

    moduleRef = await TestModuleBuilder.create()
      .withProviders([
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
          provide: EventEmitter2,
          useValue: mockEventEmitter,
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
          provide: TechniqueExecutorService,
          useValue: mockTechniqueExecutorService,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: getRepositoryToken(TechniqueExecution),
          useValue: mockTechniqueExecutionRepository,
        },
        {
          provide: getRepositoryToken(UserManipulationProfile),
          useValue: mockUserProfileRepository,
        },
      ])
      .withRequiredMocks()
      .compile();

    manipulationService = moduleRef.get<ManipulationService>(ManipulationService);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = null;
    }
  });

  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      timeout: 5000,
    },
    async () => {
      expect(manipulationService).toBeDefined();
      expect(manipulationService).toBeInstanceOf(ManipulationService);
    },
  );

  createTest(
    {
      name: 'должен инициализировать стратегию для персонажа',
      timeout: 5000,
    },
    async () => {
      const characterId = 1;
      const strategy = await manipulationService.initializeStrategy(characterId);

      expect(strategy).toBeDefined();
      expect(strategy.characterId).toBe(characterId);
      expect(strategy.primaryTechniques).toBeDefined();
      expect(Array.isArray(strategy.primaryTechniques)).toBe(true);
      expect(strategy.ethicalLimits).toBeDefined();
      expect(mockLogService.log).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен анализировать ситуацию и выбирать технику',
      timeout: 5000,
    },
    async () => {
      const characterId = 1;
      const userId = 1;

      await manipulationService.initializeStrategy(characterId);

      // Создаем контекст для анализа
      const manipulationContext: IManipulationContext = {
        characterId: characterId,
        userId: userId,
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
      expect(mockLLMService.generateJSON).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен выполнять выбранную технику манипуляции',
      timeout: 5000,
    },
    async () => {
      // Создаем контекст
      const characterId = 1;
      const userId = 1;

      const manipulationContext: IManipulationContext = {
        characterId: characterId,
        userId: userId,
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

      expect(mockTechniqueExecutorService.executeTechnique).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обновлять профиль манипуляции пользователя',
      timeout: 5000,
    },
    async () => {
      const characterId = 1;
      const userId = 1;

      const result = await manipulationService.updateUserProfile(characterId, userId, {
        vulnerabilities: ['rejection', 'insecurity'],
        successfulTechniques: [ManipulativeTechniqueType.LOVE_BOMBING],
        resistedTechniques: [ManipulativeTechniqueType.GASLIGHTING],
        emotionalTriggers: ['loneliness', 'criticism'],
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.characterId).toBeDefined();
      expect(Array.isArray(result.vulnerabilities)).toBe(true);
      expect(Array.isArray(result.successfulTechniques)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен выбирать технику для контекста',
      timeout: 5000,
    },
    async () => {
      const characterId = 1;
      const userId = 1;

      const contextData: IManipulationContext = {
        characterId: characterId,
        userId: userId,
        messageContent: 'Мне кажется, я никому не нравлюсь',
        additionalParameters: {
          conversationHistory: [],
        },
      };

      const selectedTechnique = await manipulationService.selectTechnique(contextData);

      expect(selectedTechnique).toBeDefined();
      expect(Object.values(ManipulativeTechniqueType)).toContain(selectedTechnique.techniqueType);
      if (typeof selectedTechnique.intensity === 'number') {
        expect(selectedTechnique.intensity).toBeGreaterThanOrEqual(0);
      } else {
        expect(Object.values(TechniqueIntensity)).toContain(selectedTechnique.intensity);
      }
      expect(mockLLMService.generateJSON).toHaveBeenCalled();
    },
  );
});
