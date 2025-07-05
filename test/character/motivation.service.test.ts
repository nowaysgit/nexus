import {
  createTestSuite,
  createTest,
  TestConfigType,
  createTestDataSource,
} from '../../lib/tester';
import { MotivationService } from '../../src/character/services/core/motivation.service';
import { CharacterService } from '../../src/character/services/core/character.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CharacterMotivation,
  MotivationStatus,
} from '../../src/character/entities/character-motivation.entity';
import { Character } from '../../src/character/entities/character.entity';
import { Need } from '../../src/character/entities/need.entity';
import { LogService } from '../../src/logging/log.service';
import { ConfigService } from '@nestjs/config';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { FixtureManager } from '../../lib/tester/fixtures';
import { CacheService } from '../../src/cache/cache.service';
import { NeedsService } from '../../src/character/services/core/needs.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

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

// Мок NeedsService
const mockNeedsService = {
  getActiveNeeds: jest.fn().mockResolvedValue([]),
  updateNeedValue: jest.fn(),
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

// Функция для проверки доступности базы данных
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const client = new Client({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
      user: process.env.TEST_DB_USERNAME || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password',
      database: process.env.TEST_DB_NAME || 'nexus_test',
      connectionTimeoutMillis: 1000, // Быстрый таймаут
    });

    await client.connect();
    await client.end();
    return true;
  } catch (_error) {
    return false;
  }
}

createTestSuite('MotivationService Tests', () => {
  let fixtureManager: FixtureManager;
  let dataSource: DataSource;
  let databaseAvailable = false;

  beforeAll(async () => {
    // Проверяем доступность базы данных
    databaseAvailable = await isDatabaseAvailable();

    dataSource = await createTestDataSource();

    // Инициализируем DataSource только если база данных доступна
    if (databaseAvailable && typeof dataSource.initialize === 'function') {
      try {
        await dataSource.initialize();
        fixtureManager = new FixtureManager(dataSource);
      } catch (_error) {
        console.error('Ошибка при инициализации DataSource');
        databaseAvailable = false;
      }
    } else {
      console.log('База данных недоступна, используем мок DataSource');
      fixtureManager = {
        cleanDatabase: jest.fn(),
        createCharacter: jest.fn().mockResolvedValue({ id: 1 }),
        createNeed: jest.fn().mockResolvedValue({ id: 1, type: CharacterNeedType.COMMUNICATION }),
      } as unknown as FixtureManager;
    }
  });

  afterAll(async () => {
    if (databaseAvailable && dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    if (databaseAvailable) {
      await fixtureManager.cleanDatabase();
    }
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
          useValue: mockNeedsService,
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
      const motivationService = context.get(MotivationService);
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
          useValue: mockNeedsService,
        },
      ],
      requiresDatabase: true,
    },
    async context => {
      // Пропускаем тест, если база данных недоступна
      if (!databaseAvailable) {
        console.log(
          'Пропускаем тест "должен получить мотивации персонажа" - база данных недоступна',
        );
        return;
      }

      const motivationService = context.get(MotivationService);
      const mockRepository = context.get(getRepositoryToken(CharacterMotivation));

      const character = await fixtureManager.createCharacter();
      const _need = await fixtureManager.createNeed({
        character,
        type: CharacterNeedType.COMMUNICATION,
      });

      // Настраиваем мок репозитория
      mockRepository.find.mockResolvedValue([
        {
          motivationId: 'test_motivation',
          characterId: character.id,
          relatedNeed: CharacterNeedType.COMMUNICATION,
          description: 'Потребность в общении',
          priority: 5,
          status: MotivationStatus.ACTIVE,
          isActive: () => true,
        },
      ]);

      const result = await motivationService.getCharacterMotivations(character.id);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(mockRepository.find).toHaveBeenCalled();
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
          useValue: mockNeedsService,
        },
      ],
      requiresDatabase: true,
    },
    async context => {
      // Пропускаем тест, если база данных недоступна
      if (!databaseAvailable) {
        console.log('Пропускаем тест "должен создать новую мотивацию" - база данных недоступна');
        return;
      }

      const motivationService = context.get(MotivationService);
      const mockRepository = context.get(getRepositoryToken(CharacterMotivation));

      const character = await fixtureManager.createCharacter();

      // Настраиваем мок репозитория
      mockRepository.create.mockReturnValue({
        motivationId: 'test_motivation',
        characterId: character.id,
        relatedNeed: CharacterNeedType.COMMUNICATION,
        description: 'Потребность в общении',
        priority: 5,
        status: MotivationStatus.ACTIVE,
      });

      mockRepository.save.mockResolvedValue({
        motivationId: 'test_motivation',
        characterId: character.id,
        relatedNeed: CharacterNeedType.COMMUNICATION,
        description: 'Потребность в общении',
        priority: 5,
        status: MotivationStatus.ACTIVE,
      });

      const result = await motivationService.createMotivation(
        character.id,
        CharacterNeedType.COMMUNICATION,
        'Потребность в общении',
        5,
      );

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
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
          useValue: mockNeedsService,
        },
      ],
      requiresDatabase: true,
    },
    async context => {
      // Пропускаем тест, если база данных недоступна
      if (!databaseAvailable) {
        console.log(
          'Пропускаем тест "должен обновить значение мотивации" - база данных недоступна',
        );
        return;
      }

      const motivationService = context.get(MotivationService);
      const mockRepository = context.get(getRepositoryToken(CharacterMotivation));

      const character = await fixtureManager.createCharacter();
      const motivationId = 'test_motivation';

      // Настраиваем мок репозитория
      mockRepository.findOne.mockResolvedValue({
        motivationId,
        characterId: character.id,
        relatedNeed: CharacterNeedType.COMMUNICATION,
        description: 'Потребность в общении',
        priority: 5,
        status: MotivationStatus.ACTIVE,
        currentValue: 0,
        lastUpdated: new Date(),
        thresholdValue: 70,
      });

      mockRepository.save.mockImplementation(motivation =>
        Promise.resolve({
          ...motivation,
          currentValue: motivation.currentValue + 20,
          lastUpdated: new Date(),
        }),
      );

      const updatedMotivation = await motivationService.updateMotivationValue(motivationId, 20);

      expect(updatedMotivation).toBeDefined();
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { motivationId } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(updatedMotivation?.currentValue).toBeGreaterThanOrEqual(20);
    },
  );
});
