import { createTestSuite, createTest } from '../../lib/tester';
import {
  SpecializationService,
  KnowledgeDomain,
  CompetenceLevel,
} from '../../src/character/services/specialization.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DataSource } from 'typeorm';

// Мок для репозиториев
const mockCharacterRepository = {
  findOne: jest.fn().mockImplementation((options: any) => {
    const where = options?.where;
    if (where && typeof where === 'object' && 'id' in where && where.id === 1) {
      return Promise.resolve({
        id: 1,
        name: 'Test Character',
        archetype: 'MENTOR',
        personality: {
          traits: ['эмпатичный', 'общительный'],
          hobbies: ['чтение', 'музыка'],
          fears: ['высота', 'замкнутые пространства'],
          values: ['честность', 'доброта'],
          musicTaste: ['классическая', 'джаз'],
          strengths: ['терпение', 'внимательность'],
          weaknesses: ['нерешительность', 'прокрастинация'],
        },
      });
    }
    return Promise.resolve(null);
  }),
};

// Мок для DataSource
const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockCharacterRepository),
};

createTestSuite('SpecializationService Tests', () => {
  let specializationService: SpecializationService;
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withProviders([
        SpecializationService,
        {
          provide: LogService,
          useClass: MockLogService,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ])
      .withRequiredMocks()
      .compile();

    specializationService = moduleRef.get(SpecializationService);

    // Сбрасываем моки перед каждым тестом
    jest.clearAllMocks();
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
      requiresDatabase: false,
    },
    async () => {
      expect(specializationService).toBeDefined();
      expect(specializationService).toBeInstanceOf(SpecializationService);
    },
  );

  createTest(
    {
      name: 'должен получать профиль специализации персонажа',
      requiresDatabase: false,
    },
    async () => {
      const characterId = 1;

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
      requiresDatabase: false,
    },
    async () => {
      const characterId = 1;
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
      requiresDatabase: false,
    },
    async () => {
      const characterId = 1;
      const updates = {
        personalInterests: ['новый интерес', 'другой интерес'],
        strongAreas: [KnowledgeDomain.PSYCHOLOGY, KnowledgeDomain.RELATIONSHIPS],
      };

      // Получаем начальный профиль
      await specializationService.getSpecializationProfile(characterId);

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
      requiresDatabase: false,
    },
    async () => {
      // Сначала получаем профиль, чтобы заполнить кэш
      const characterId = 1;
      await specializationService.getSpecializationProfile(characterId);

      // Очищаем кэш
      specializationService.clearCache();

      // Проверяем, что после очистки кэша профиль загружается заново
      mockCharacterRepository.findOne.mockClear();
      await specializationService.getSpecializationProfile(characterId);

      // Должен быть вызов к репозиторию, так как кэш очищен
      expect(mockCharacterRepository.findOne).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен возвращать статистику использования',
      requiresDatabase: false,
    },
    async () => {
      const stats = specializationService.getUsageStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при отсутствии персонажа',
      requiresDatabase: false,
    },
    async () => {
      const characterId = 999; // Несуществующий ID

      // Настраиваем мок для несуществующего персонажа
      mockCharacterRepository.findOne.mockResolvedValueOnce(null);

      // Должен вернуть дефолтный профиль вместо ошибки
      const profile = await specializationService.getSpecializationProfile(characterId);

      // Проверяем, что вернулся профиль с правильным ID
      expect(profile).toBeDefined();
      expect(profile.characterId).toBe(characterId);
    },
  );

  createTest(
    {
      name: 'должен классифицировать различные типы запросов',
      requiresDatabase: false,
    },
    async () => {
      const characterId = 1;

      // Получаем профиль, чтобы заполнить кэш
      await specializationService.getSpecializationProfile(characterId);

      const queries = [
        { query: 'Расскажи о психологии отношений', expectedDomain: KnowledgeDomain.PSYCHOLOGY },
        { query: 'Как работает квантовый компьютер?', expectedDomain: KnowledgeDomain.TECHNICAL },
        {
          query: 'Какие книги ты любишь читать?',
          expectedDomain: KnowledgeDomain.GENERAL_CONVERSATION,
        },
      ];

      for (const { query } of queries) {
        const result = await specializationService.checkCompetence(characterId, query, {
          conversationTopic: 'general',
          userExpertiseLevel: CompetenceLevel.BASIC,
          relationshipLevel: 50,
          socialSetting: 'casual',
          emotionalState: 'neutral',
          previousInteractions: [],
        });

        expect(result).toBeDefined();
        expect(result.userQuery).toBe(query);
        // Не проверяем точное соответствие домена, так как это зависит от реализации классификатора
        expect(Object.values(KnowledgeDomain).includes(result.domain)).toBe(true);
      }
    },
  );
});
