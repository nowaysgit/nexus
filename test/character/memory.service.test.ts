import { createTestSuite, createTest, TestConfigType } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures';
import { MemoryService } from '../../src/character/services/memory.service';
import { LogService } from '../../src/logging/log.service';
import {
  CharacterMemory,
  MemoryImportanceLevel,
} from '../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../src/character/interfaces/memory.interfaces';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';
import { Tester } from '../../lib/tester';

createTestSuite('MemoryService Tests', () => {
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
  });

  createTest(
    {
      name: 'должен быть определен',
      configType: TestConfigType.DATABASE,
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: LogService,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn(),
          },
        },
      ],
      imports: [TypeOrmModule.forFeature([CharacterMemory, Character])],
      timeout: 10000,
    },
    async context => {
      const service = context.get(MemoryService);
      expect(service).toBeDefined();
    },
  );

  createTest(
    {
      name: 'should create memory successfully',
      configType: TestConfigType.INTEGRATION,
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: LogService,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn(),
          },
        },
        {
          provide: FixtureManager,
          useFactory: () => {
            return new FixtureManager(Tester.getInstance().getDataSource());
          },
        },
      ],
      imports: [TypeOrmModule.forFeature([CharacterMemory, Character])],
      timeout: 10000,
      requiresDatabase: true,
    },
    async context => {
      const service = context.get(MemoryService);
      const fixtureManager = context.get(FixtureManager);
      const mockRepository = context.get(getRepositoryToken(CharacterMemory));

      const character = await fixtureManager.createCharacter({
        name: 'Тест Персонаж',
      });
      const mockMemory = {
        id: 1,
        characterId: character.id,
        content: 'Test memory',
        type: MemoryType.EVENT,
        importance: MemoryImportanceLevel.AVERAGE,
        metadata: {},
        memoryDate: new Date(),
        isActive: true,
      };

      (mockRepository.create as jest.Mock).mockReturnValue(mockMemory);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockMemory);
      (mockRepository.count as jest.Mock).mockResolvedValue(5);

      const result = await service.createMemory(
        character.id,
        'Test memory',
        MemoryType.EVENT,
        MemoryImportanceLevel.AVERAGE,
        {},
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        characterId: character.id,
        content: 'Test memory',
        type: MemoryType.EVENT,
        importance: MemoryImportanceLevel.AVERAGE,
        metadata: {},
        memoryDate: expect.any(Date),
        isActive: true,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockMemory);
      expect(result).toEqual(mockMemory);
    },
  );

  createTest(
    {
      name: 'should update memory importance',
      configType: TestConfigType.INTEGRATION,
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: LogService, useValue: { setContext: jest.fn(), debug: jest.fn() } },
      ],
      imports: [TypeOrmModule.forFeature([CharacterMemory, Character])],
      requiresDatabase: true,
    },
    async context => {
      const service = context.get(MemoryService);
      const mockRepository = context.get(getRepositoryToken(CharacterMemory));

      const mockMemory = {
        id: 1,
        content: 'Test memory',
        importance: MemoryImportanceLevel.AVERAGE,
      };
      const updatedMemory = {
        ...mockMemory,
        importance: MemoryImportanceLevel.HIGH,
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockMemory);
      (mockRepository.save as jest.Mock).mockResolvedValue(updatedMemory);

      const result = await service.updateMemoryImportance(1, MemoryImportanceLevel.HIGH);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedMemory);
      expect(result).toEqual(updatedMemory);
    },
  );

  createTest(
    {
      name: 'should return null when updating non-existent memory importance',
      configType: TestConfigType.INTEGRATION,
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: LogService, useValue: { setContext: jest.fn(), warn: jest.fn() } },
      ],
      imports: [TypeOrmModule.forFeature([CharacterMemory, Character])],
      requiresDatabase: true,
    },
    async context => {
      const service = context.get(MemoryService);
      const mockRepository = context.get(getRepositoryToken(CharacterMemory));

      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.updateMemoryImportance(999, MemoryImportanceLevel.HIGH);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(result).toBeNull();
    },
  );
});
