import { createTestSuite, createTest, TestConfigType, Tester } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import {
  SpecializationService,
  KnowledgeDomain,
  CompetenceLevel,
} from '../../src/character/services/specialization.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { Character } from '../../src/character/entities/character.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheService } from '../../src/cache/cache.service';
import { LLMService } from '../../src/llm/services/llm.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockLLMService = {
  generateJSON: jest.fn().mockResolvedValue({
    domains: {
      psychology: CompetenceLevel.EXPERT,
      music: CompetenceLevel.PROFICIENT,
      technology: CompetenceLevel.BASIC,
    },
    strongAreas: ['эмпатия', 'психология отношений'],
    weakAreas: ['программирование', 'точные науки'],
    personalInterests: ['чтение', 'музыка'],
    naturalIgnorancePatterns: ['технические детали', 'математические формулы'],
  }),
};

const mockLogService = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

createTestSuite('SpecializationService Tests', () => {
  let tester: Tester;
  let fixtureManager: FixtureManager;
  let specializationService: SpecializationService;

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
  afterEach(() => {
    // Очищаем кэш сервиса
    if (specializationService) {
      specializationService.clearCache();
    }
  });
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.DATABASE,
      providers: [
        SpecializationService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      expect(specializationService).toBeDefined();
      expect(specializationService).toBeInstanceOf(SpecializationService);
    },
  );

  createTest(
    {
      name: 'должен получать профиль специализации персонажа',
      configType: TestConfigType.DATABASE,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: FixtureManager,
          useFactory: () => {
            return new FixtureManager(Tester.getInstance().getDataSource());
          },
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      // Создаем тестового персонажа с помощью FixtureManager
      const fixtureManager = context.get(FixtureManager) as FixtureManager;
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;

      const profile = await specializationService.getSpecializationProfile(characterId);

      expect(profile).toBeDefined();
      expect(typeof profile).toBe('object');
      expect(profile.characterId).toBe(characterId);
      expect(profile.competenceLevels).toBeDefined();
      expect(typeof profile.competenceLevels).toBe('object');
      expect(Array.isArray(profile.strongAreas)).toBe(true);
      expect(Array.isArray(profile.weakAreas)).toBe(true);
      expect(Array.isArray(profile.personalInterests)).toBe(true);
      expect(Array.isArray(profile.naturalIgnorancePatterns)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен проверять компетенцию персонажа для ответа на запрос',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      // Создаем тестового персонажа
      const fixtureManager = context.get(FixtureManager) as FixtureManager;
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;
      const userQuery = 'Расскажи о психологии отношений';
      const knowledgeContext = {
        conversationTopic: 'psychology',
        userExpertiseLevel: CompetenceLevel.BASIC,
        relationshipLevel: 50,
        socialSetting: 'casual' as const,
        emotionalState: 'neutral',
        previousInteractions: [],
      };

      const competenceCheck = await specializationService.checkCompetence(
        characterId,
        userQuery,
        knowledgeContext,
      );

      expect(competenceCheck).toBeDefined();
      expect(typeof competenceCheck).toBe('object');
      expect(competenceCheck.domain).toBeDefined();
      expect(Object.values(KnowledgeDomain).includes(competenceCheck.domain)).toBe(true);
      expect(competenceCheck.userQuery).toBe(userQuery);
      expect(Object.values(CompetenceLevel).includes(competenceCheck.characterCompetence)).toBe(
        true,
      );
      expect(typeof competenceCheck.shouldRespond).toBe('boolean');
      expect(
        ['answer', 'partial_answer', 'redirect', 'admit_ignorance', 'express_curiosity'].includes(
          competenceCheck.responseStrategy,
        ),
      ).toBe(true);
      expect(typeof competenceCheck.suggestedResponse).toBe('string');
      expect(Array.isArray(competenceCheck.contextualFactors)).toBe(true);
    },
  );

  createTest(
    {
      name: 'должен обновлять профиль специализации персонажа',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      // Создаем тестового персонажа
      const fixtureManager = context.get(FixtureManager) as FixtureManager;
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;
      const updates = {
        personalInterests: ['новый интерес', 'другой интерес'],
        strongAreas: [KnowledgeDomain.PSYCHOLOGY, KnowledgeDomain.RELATIONSHIPS],
      };

      const updatedProfile = await specializationService.updateSpecializationProfile(
        characterId,
        updates,
      );

      expect(updatedProfile).toBeDefined();
      expect(typeof updatedProfile).toBe('object');
      expect(updatedProfile.characterId).toBe(characterId);
      expect(updatedProfile.personalInterests).toEqual(updates.personalInterests);
      expect(updatedProfile.strongAreas).toEqual(updates.strongAreas);
    },
  );

  createTest(
    {
      name: 'должен очищать кэш профилей',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      // Создаем тестового персонажа
      const fixtureManager = context.get(FixtureManager) as FixtureManager;
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      // Сначала получаем профиль, чтобы он попал в кэш
      await specializationService.getSpecializationProfile(character.id);

      // Очищаем кэш
      specializationService.clearCache();

      // Проверяем, что метод не выбрасывает ошибку
      expect(() => specializationService.clearCache()).not.toThrow();
    },
  );

  createTest(
    {
      name: 'должен возвращать статистику использования',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      const statistics = specializationService.getUsageStatistics();

      expect(statistics).toBeDefined();
      expect(typeof statistics).toBe('object');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отсутствии персонажа',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      const characterId = 999;

      // Должен вернуть профиль по умолчанию при отсутствии персонажа
      const profile = await specializationService.getSpecializationProfile(characterId);

      expect(profile).toBeDefined();
      expect(profile.characterId).toBe(characterId);
      expect(typeof profile.competenceLevels).toBe('object');
    },
  );

  createTest(
    {
      name: 'должен классифицировать различные типы запросов',
      configType: TestConfigType.INTEGRATION,
      providers: [
        SpecializationService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      imports: [TypeOrmModule.forFeature([Character])],
      timeout: 10000,
    },
    async context => {
      specializationService = context.get(SpecializationService) as SpecializationService;

      // Создаем тестового персонажа
      const fixtureManager = context.get(FixtureManager) as FixtureManager;
      const character = await fixtureManager.createCharacter({
        name: 'Тест',
        personality: {
          traits: ['любознательная', 'общительная'],
          hobbies: ['чтение', 'музыка'],
          fears: ['одиночество'],
          values: ['честность'],
          musicTaste: ['классика'],
          strengths: ['эмпатия'],
          weaknesses: ['нерешительность'],
        },
      });
      const characterId = character.id;
      const knowledgeContext = {
        conversationTopic: 'general',
        userExpertiseLevel: CompetenceLevel.BASIC,
        relationshipLevel: 30,
        socialSetting: 'casual' as const,
        emotionalState: 'neutral',
        previousInteractions: [],
      };

      // Тестируем разные типы запросов
      const queries = [
        'Как дела?', // общение
        'Что такое любовь?', // отношения
        'Объясни квантовую физику', // наука
        'Какой фильм посмотреть?', // развлечения
      ];

      for (const query of queries) {
        const competenceCheck = await specializationService.checkCompetence(
          characterId,
          query,
          knowledgeContext,
        );

        expect(competenceCheck).toBeDefined();
        expect(competenceCheck.domain).toBeDefined();
        expect(Object.values(KnowledgeDomain).includes(competenceCheck.domain)).toBe(true);
        expect(competenceCheck.userQuery).toBe(query);
      }
    },
  );
});
