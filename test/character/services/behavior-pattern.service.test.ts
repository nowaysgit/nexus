import { createTest, createTestSuite, TestConfigType } from '../../../lib/tester';
import { BehaviorPatternService } from '../../../src/character/services/behavior/behavior-pattern.service';
import { LLMService } from '../../../src/llm/services/llm.service';
import { LogService } from '../../../src/logging/log.service';
import { EmotionalStateService } from '../../../src/character/services/core/emotional-state.service';
import { MotivationIntensity } from '../../../src/character/entities/character-motivation.entity';

// Создаем мок для EmotionalStateService
const createEmotionalStateServiceMock = () => ({
  getEmotionalState: jest.fn(),
  updateEmotionalState: jest.fn(),
  createEmotionalState: jest.fn(),
});

// Создаем мок для LLMService
const createLLMServiceMock = () => ({
  generateResponse: jest.fn(),
  analyzeText: jest.fn(),
});

// Создаем мок для LogService
const createLogServiceMock = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
});

createTestSuite('BehaviorPatternService', () => {
  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'должен определять нейтральный паттерн для персонажа без эмоций',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const pattern = await service.determineBehaviorPattern(1);

      expect(pattern.type).toBe('neutral');
      expect(pattern.description).toContain('Нейтральное поведение');
      expect(pattern.triggers).toContain('default');
      expect(pattern.actions).toContain('standard_response');
    },
  );

  createTest(
    {
      name: 'должен определять интенсивный эмоциональный паттерн',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue({
              primary: 'anger',
              secondary: 'frustration',
              intensity: 85,
            }),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const pattern = await service.determineBehaviorPattern(1);

      expect(pattern.type).toBe('intense_anger');
      expect(pattern.description).toContain('Интенсивное поведение');
      expect(pattern.triggers).toContain('high_anger');
      expect(pattern.emotionalFactors).toContain('anger');
    },
  );

  createTest(
    {
      name: 'должен определять мотивационный паттерн для сильной мотивации',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [
                {
                  id: 1,
                  relatedNeed: 'social_interaction',
                  intensity: MotivationIntensity.CRITICAL,
                  priority: 9,
                },
              ],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const pattern = await service.determineBehaviorPattern(1);

      expect(pattern.type).toBe('driven_social_interaction');
      expect(pattern.description).toContain('Сильно мотивированное поведение');
      expect(pattern.triggers).toContain('high_social_interaction');
      expect(pattern.actions).toContain('pursue_social_interaction');
    },
  );

  createTest(
    {
      name: 'должен определять паттерн на основе положительной памяти',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 1, importance: 8, content: 'Positive memory 1' },
              { id: 2, importance: 9, content: 'Positive memory 2' },
              { id: 3, importance: 7, content: 'Positive memory 3' },
            ]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const pattern = await service.determineBehaviorPattern(1);

      expect(pattern.type).toBe('positive_experience');
      expect(pattern.description).toContain('положительного опыта');
      expect(pattern.triggers).toContain('positive_memories');
      expect(pattern.emotionalFactors).toContain('happiness');
    },
  );

  createTest(
    {
      name: 'должен проверять активность триггера поведения',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const isTriggered = await service.isTriggeredBehavior(1, 'default');

      expect(isTriggered).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен получать рекомендуемые действия',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              motivations: [],
            }),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: {
            ...createEmotionalStateServiceMock(),
            getEmotionalState: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      const actions = await service.getRecommendedActions(1);

      expect(actions).toContain('standard_response');
      expect(Array.isArray(actions)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отсутствии персонажа',
      configType: TestConfigType.BASIC,
      imports: [],
      providers: [
        {
          provide: BehaviorPatternService,
          useClass: BehaviorPatternService,
        },
        {
          provide: 'CharacterRepository',
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: 'CharacterMemoryRepository',
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LLMService,
          useValue: createLLMServiceMock(),
        },
        {
          provide: EmotionalStateService,
          useValue: createEmotionalStateServiceMock(),
        },
        {
          provide: LogService,
          useValue: createLogServiceMock(),
        },
      ],
    },
    async context => {
      const service = context.get(BehaviorPatternService);

      await expect(service.determineBehaviorPattern(999)).rejects.toThrow(
        'Персонаж с ID 999 не найден',
      );
    },
  );
});
