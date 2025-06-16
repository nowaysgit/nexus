import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManipulationService } from '../../src/character/services/manipulation.service';
import { LogService } from '../../src/logging/log.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { EmotionalStateService } from '../../src/character/services/emotional-state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Character } from '../../src/character/entities/character.entity';
import {
  TechniqueExecution,
  UserManipulationProfile,
} from '../../src/character/entities/manipulation-technique.entity';
import { IManipulationContext } from '../../src/character/interfaces/technique.interfaces';
import {
  ManipulativeTechniqueType,
  TechniqueIntensity,
} from '../../src/character/enums/technique.enums';
import { MockNeedsService, MockEmotionalStateService } from '../../lib/tester/mocks/jest.mocks';

createTestSuite('ManipulationService Tests', () => {
  let fixtureManager: FixtureManager;
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let manipulationService: ManipulationService;

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
    generateJSON: jest.fn().mockResolvedValue({ analysis: {} }),
    analyzeMessage: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockPromptTemplateService = {
    createPrompt: jest.fn().mockReturnValue('Системный промпт для манипуляции'),
    createCharacterSystemPrompt: jest.fn(),
    createAnalysisPrompt: jest.fn(),
    setContext: jest.fn().mockReturnThis(),
  };

  const mockNeedsService = MockNeedsService;

  const mockEmotionalStateService = MockEmotionalStateService;

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([
        TypeOrmModule.forFeature([Character, TechniqueExecution, UserManipulationProfile]),
      ])
      .withProviders([
        ManipulationService,
        { provide: LogService, useValue: mockLogService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: PromptTemplateService, useValue: mockPromptTemplateService },
        { provide: NeedsService, useValue: mockNeedsService },
        { provide: EmotionalStateService, useValue: mockEmotionalStateService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    manipulationService = moduleRef.get<ManipulationService>(ManipulationService);

    await fixtureManager.cleanDatabase();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (moduleRef) {
      await moduleRef.close();
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
      const character = await fixtureManager.createCharacter({});
      const strategy = await manipulationService.initializeStrategy(character.id);

      expect(strategy).toBeDefined();
      expect(strategy.characterId).toBe(character.id);
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
      // Инициализируем стратегию
      const character = await fixtureManager.createCharacter({});
      const user = await fixtureManager.createUser({});

      await manipulationService.initializeStrategy(character.id);

      // Создаем контекст для анализа
      const manipulationContext: IManipulationContext = {
        characterId: character.id,
        userId: user.id,
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
      const character = await fixtureManager.createCharacter({});
      const user = await fixtureManager.createUser({});

      const manipulationContext: IManipulationContext = {
        characterId: character.id,
        userId: user.id,
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
      timeout: 5000,
    },
    async () => {
      const character = await fixtureManager.createCharacter({});
      const user = await fixtureManager.createUser({});

      const result = await manipulationService.updateUserProfile(user.id, character.id, {
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
