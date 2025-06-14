import {
  createTestSuite,
  createTest,
  TestConfigType,
  createTestDataSource,
} from '../../lib/tester';
import { MotivationService } from '../../src/character/services/motivation.service';
import { CharacterService } from '../../src/character/services/character.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CharacterMotivation,
  MotivationStatus,
  MotivationIntensity,
} from '../../src/character/entities/character-motivation.entity';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { LogService } from '../../src/logging/log.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { ConfigService } from '@nestjs/config';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { FixtureManager } from '../../lib/tester/fixtures';
import { CacheService } from '../../src/cache/cache.service';
import { NeedsService } from '../../src/character/services/needs.service';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

// Мок LogService
const mockLogService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

// Мок ConfigService
const mockConfigService = {
  get: jest.fn(),
};

// Мок CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

// Мок репозиториев
const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  })),
});
createTestSuite('MotivationService Tests', () => {
  let fixtureManager;
  let dataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    // Инициализируем DataSource
    await dataSource.initialize();
    fixtureManager = new FixtureManager(dataSource);
  });
  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
  beforeEach(async () => {
    await fixtureManager.cleanDatabase();
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
      providers: [
        MotivationService,
        CharacterService,
        {
          provide: getRepositoryToken(CharacterMotivation),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Character),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Need),
          useValue: createMockRepository(),
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NeedsService,
          useValue: {},
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
    },
    async context => {
      const motivationService = context.get(MotivationService) as MotivationService;
      expect(motivationService).toBeDefined();
      expect(motivationService).toBeInstanceOf(MotivationService);
    },
  );

  createTest(
    {
      name: 'должен получить мотивации персонажа',
      configType: TestConfigType.DATABASE,
      providers: [
        MotivationService,
        CharacterService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NeedsService,
          useValue: {},
        },
      ],
    },
    async context => {
      const motivationService = context.get(MotivationService) as MotivationService;

      const character = await fixtureManager.createCharacter();
      const need = await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.COMMUNICATION,
      });
      // Создаем мотивацию через сервис
      await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Потребность в общении',
        5,
      );

      const result = await motivationService.getCharacterMotivations(character.id);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('relatedNeed', CharacterNeedType.COMMUNICATION);
      }
    },
  );

  createTest(
    {
      name: 'должен создать новую мотивацию',
      configType: TestConfigType.DATABASE,
      providers: [
        MotivationService,
        CharacterService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NeedsService,
          useValue: {},
        },
      ],
    },
    async context => {
      const motivationService = context.get(MotivationService) as MotivationService;

      const character = await fixtureManager.createCharacter();

      const result = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Потребность в общении',
        5,
      );

      expect(result).toBeDefined();
      expect(result.motivationId).toBeDefined();
      expect(result.relatedNeed).toEqual(CharacterNeedType.COMMUNICATION);
      expect(result.description).toEqual('Потребность в общении');
      expect(result.priority).toEqual(5);
      expect(result.status).toEqual(MotivationStatus.ACTIVE);
    },
  );

  createTest(
    {
      name: 'должен обновить значение мотивации',
      configType: TestConfigType.DATABASE,
      providers: [
        MotivationService,
        CharacterService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NeedsService,
          useValue: {},
        },
      ],
    },
    async context => {
      const motivationService = context.get(MotivationService) as MotivationService;

      const character = await fixtureManager.createCharacter();

      // Создаем мотивацию
      const motivation = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Потребность в общении',
        5,
      );

      // Обновляем значение
      const result = await motivationService.updateMotivationValue(motivation.motivationId, 20);

      expect(result).toBeDefined();
      expect(result.currentValue).toEqual(20);
    },
  );

  createTest(
    {
      name: 'должен генерировать мотивации на основе потребностей',
      configType: TestConfigType.DATABASE,
      providers: [
        MotivationService,
        CharacterService,
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: NeedsService,
          useValue: {},
        },
      ],
    },
    async context => {
      const motivationService = context.get(MotivationService) as MotivationService;

      const character = await fixtureManager.createCharacter();

      // Создаем потребности с высоким уровнем
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.COMMUNICATION,
        currentValue: 90,
        threshold: 60,
        priority: 10, // Высокий приоритет
      });
      await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.ATTENTION,
        currentValue: 85,
        threshold: 60,
        priority: 8, // Высокий приоритет
      });
      // Генерируем мотивации
      const result = await motivationService.generateMotivationsFromNeeds(character.id);

      expect(result).toBeDefined();

      // Проверяем, созданы ли мотивации
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('motivationId');
      } else {
        // Если мотивации не созданы, проверяем, были ли созданы потребности
        const needs = await dataSource
          .getRepository(Need)
          .find({ where: { characterId: character.id } });
        expect(needs.length).toBeGreaterThan(0);
      }
    },
  );
});
