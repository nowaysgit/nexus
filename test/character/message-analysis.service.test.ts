import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { MessageAnalysisService } from '../../src/character/services/message-analysis.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { LLMService } from '../../src/llm/services/llm.service';
import { PromptTemplateService } from '../../src/prompt-template/prompt-template.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { UserService } from '../../src/user/services/user.service';
import { Character } from '../../src/character/entities/character.entity';
import { MessageAnalysis } from '../../src/character/interfaces/analysis.interfaces';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { Tester } from '../../lib/tester';

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
  generateJSON: jest.fn().mockResolvedValue({
    needsImpact: { communication: 5, attention: 3 },
    emotionalAnalysis: {
      userMood: 'neutral',
      emotionalIntensity: 0.5,
      triggerEmotions: ['curiosity'],
      expectedEmotionalResponse: 'engaged',
    },
    manipulationAnalysis: {
      userVulnerability: 0.3,
      applicableTechniques: [],
      riskLevel: 'low',
      recommendedIntensity: 0.1,
    },
    specializationAnalysis: {
      topicsRelevantToCharacter: [],
      knowledgeGapDetected: false,
      responseComplexityLevel: 'simple',
    },
    behaviorAnalysis: {
      interactionType: 'casual',
      responseTone: 'friendly',
      initiativeLevel: 0.6,
      conversationDirection: 'continue',
    },
    urgency: 0.5,
    sentiment: 'neutral',
    keywords: ['тест'],
    topics: ['общение'],
  }),
  generateText: jest.fn(),
  analyzeMessage: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockPromptTemplateService = {
  createPrompt: jest.fn().mockReturnValue('Системный промпт для анализа'),
  createCharacterSystemPrompt: jest.fn(),
  createAnalysisPrompt: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockNeedsService = {
  getNeedsByCharacter: jest.fn().mockResolvedValue([
    {
      id: 1,
      type: CharacterNeedType.COMMUNICATION,
      currentValue: 50,
      threshold: 70,
      priority: 'high',
    },
    {
      id: 2,
      type: CharacterNeedType.SECURITY,
      currentValue: 30,
      threshold: 60,
      priority: 'medium',
    },
  ]),
  findByCharacterId: jest.fn(),
  updateNeed: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockDialogService = {
  getDialogHistory: jest.fn().mockResolvedValue([
    {
      id: 1,
      content: 'Привет!',
      timestamp: new Date(),
    },
    {
      id: 2,
      content: 'Как дела?',
      timestamp: new Date(),
    },
  ]),
  saveMessage: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockUserService = {
  findById: jest.fn().mockResolvedValue({
    id: 1,
    username: 'testuser',
  }),
  create: jest.fn(),
  update: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

createTestSuite('MessageAnalysisService Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;

  beforeAll(async () => {
    tester = Tester.getInstance();
    const dataSource = await tester.setupTestEnvironment(TestConfigType.DATABASE);
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    await tester.forceCleanup();
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
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
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);
      expect(messageAnalysisService).toBeDefined();
      expect(messageAnalysisService).toBeInstanceOf(MessageAnalysisService);
    },
  );

  createTest(
    {
      name: 'должен анализировать сообщение пользователя',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
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
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        fullName: 'Анна Петрова',
        biography: 'Молодая художница',
        personality: {
          traits: ['творческая', 'эмоциональная'],
          hobbies: ['рисование', 'музыка'],
          fears: ['одиночество'],
          values: ['красота', 'свобода'],
        },
      } as Character;

      const analysis = await messageAnalysisService.analyzeUserMessage(
        mockCharacter,
        1,
        'Привет! Как дела?',
      );

      expect(analysis).toBeDefined();
      expect(analysis.needsImpact).toBeDefined();
      expect(analysis.emotionalAnalysis).toBeDefined();
      expect(analysis.manipulationAnalysis).toBeDefined();
      expect(analysis.specializationAnalysis).toBeDefined();
      expect(analysis.behaviorAnalysis).toBeDefined();
      expect(analysis.urgency).toBeDefined();
      expect(analysis.sentiment).toBeDefined();
      expect(analysis.keywords).toBeDefined();
      expect(analysis.topics).toBeDefined();
      expect(analysis.analysisMetadata).toBeDefined();

      expect(mockNeedsService.getNeedsByCharacter).toHaveBeenCalledWith(1);
      expect(mockDialogService.getDialogHistory).toHaveBeenCalledWith('1', 1, 5);
      expect(mockPromptTemplateService.createPrompt).toHaveBeenCalled();
      expect(mockLLMService.generateJSON).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен возвращать анализ с правильной структурой',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
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
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        fullName: 'Анна Петрова',
        biography: 'Молодая художница',
        personality: {
          traits: ['творческая'],
        },
      } as Character;

      const analysis = await messageAnalysisService.analyzeUserMessage(
        mockCharacter,
        1,
        'Расскажи о себе',
      );

      // Проверяем структуру needsImpact
      expect(analysis.needsImpact).toEqual(
        expect.objectContaining({
          communication: expect.any(Number),
          attention: expect.any(Number),
        }),
      );

      // Проверяем структуру emotionalAnalysis
      expect(analysis.emotionalAnalysis).toEqual(
        expect.objectContaining({
          userMood: expect.any(String),
          emotionalIntensity: expect.any(Number),
          triggerEmotions: expect.any(Array),
          expectedEmotionalResponse: expect.any(String),
        }),
      );

      // Проверяем структуру manipulationAnalysis
      expect(analysis.manipulationAnalysis).toEqual(
        expect.objectContaining({
          userVulnerability: expect.any(Number),
          applicableTechniques: expect.any(Array),
          riskLevel: expect.any(String),
          recommendedIntensity: expect.any(Number),
        }),
      );

      // Проверяем структуру behaviorAnalysis
      expect(analysis.behaviorAnalysis).toEqual(
        expect.objectContaining({
          interactionType: expect.any(String),
          responseTone: expect.any(String),
          initiativeLevel: expect.any(Number),
          conversationDirection: expect.any(String),
        }),
      );

      // Проверяем метаданные
      expect(analysis.analysisMetadata).toEqual(
        expect.objectContaining({
          confidence: expect.any(Number),
          processingTime: expect.any(Number),
          llmProvider: expect.any(String),
          analysisVersion: expect.any(String),
          timestamp: expect.any(Date),
        }),
      );
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки и возвращать fallback анализ',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: LLMService,
          useValue: {
            ...mockLLMService,
            generateJSON: jest.fn().mockRejectedValue(new Error('LLM Error')),
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
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        personality: {},
      } as Character;

      const analysis = await messageAnalysisService.analyzeUserMessage(
        mockCharacter,
        1,
        'Тестовое сообщение',
      );

      expect(analysis).toBeDefined();
      expect(analysis.needsImpact).toBeDefined();
      expect(analysis.emotionalAnalysis).toBeDefined();
      expect(analysis.manipulationAnalysis).toBeDefined();
      expect(analysis.specializationAnalysis).toBeDefined();
      expect(analysis.behaviorAnalysis).toBeDefined();
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при построении контекста',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
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
          useValue: {
            ...mockNeedsService,
            getNeedsByCharacter: jest.fn().mockRejectedValue(new Error('Needs Error')),
          },
        },
        {
          provide: DialogService,
          useValue: {
            ...mockDialogService,
            getDialogHistory: jest.fn().mockRejectedValue(new Error('Dialog Error')),
          },
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        personality: {},
      } as Character;

      const analysis = await messageAnalysisService.analyzeUserMessage(
        mockCharacter,
        1,
        'Тестовое сообщение',
      );

      expect(analysis).toBeDefined();
      expect(mockLogService.error).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен правильно валидировать типы данных в анализе',
      configType: TestConfigType.DATABASE,
      providers: [
        MessageAnalysisService,
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
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      const messageAnalysisService = context.get(MessageAnalysisService);

      const mockCharacter: Character = {
        id: 1,
        name: 'Анна',
        personality: {},
      } as Character;

      const analysis = await messageAnalysisService.analyzeUserMessage(
        mockCharacter,
        1,
        'Тестовое сообщение',
      );

      // Проверяем типы данных
      expect(typeof analysis.urgency).toBe('number');
      expect(typeof analysis.sentiment).toBe('string');
      expect(Array.isArray(analysis.keywords)).toBe(true);
      expect(Array.isArray(analysis.topics)).toBe(true);
      expect(typeof analysis.emotionalAnalysis.emotionalIntensity).toBe('number');
      expect(typeof analysis.manipulationAnalysis.userVulnerability).toBe('number');
      expect(typeof analysis.behaviorAnalysis.initiativeLevel).toBe('number');
    },
  );
});
