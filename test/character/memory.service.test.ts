import { createTestSuite, createTest } from '../../lib/tester';
import { FixtureManager } from '../../lib/tester/fixtures/fixture-manager';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryService } from '../../src/character/services/core/memory.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';
import {
  CharacterMemory,
  MemoryImportanceLevel,
} from '../../src/character/entities/character-memory.entity';
import { MemoryType } from '../../src/character/interfaces/memory.interfaces';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Character } from '../../src/character/entities/character.entity';

createTestSuite('MemoryService Tests', () => {
  let moduleRef: import('@nestjs/testing').TestingModule | null = null;
  let dataSource: DataSource;
  let fixtureManager: FixtureManager;
  let memoryService: MemoryService;

  // создаём общий мок репозитория, который будем переопределять в тестах
  const mockMemoryRepository: jest.Mocked<Repository<CharacterMemory>> = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    // partial mock for query builder chain
    createQueryBuilder: jest.fn((): unknown => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  } as unknown as jest.Mocked<Repository<CharacterMemory>>;

  const mockLogService = new MockLogService();

  beforeEach(async () => {
    moduleRef = await TestModuleBuilder.create()
      .withImports([TypeOrmModule.forFeature([CharacterMemory, Character])])
      .withProviders([
        MemoryService,
        { provide: LogService, useValue: mockLogService },
        { provide: getRepositoryToken(CharacterMemory), useValue: mockMemoryRepository },
      ])
      .withRequiredMocks()
      .compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    fixtureManager = new FixtureManager(dataSource);
    memoryService = moduleRef.get<MemoryService>(MemoryService);

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

  createTest({ name: 'должен быть определен', timeout: 3000 }, async () => {
    expect(memoryService).toBeDefined();
  });

  createTest({ name: 'should create memory successfully', timeout: 10000 }, async () => {
    const mockRepository = mockMemoryRepository;

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
      recallCount: 0,
      lastRecalled: null,
      isLongTerm: false,
      character: character,
      summary: null,
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      relatedMemories: [],
    } as CharacterMemory;

    jest.mocked(mockRepository.create).mockReturnValue(mockMemory);
    jest.mocked(mockRepository.save).mockResolvedValue(mockMemory);
    jest.mocked(mockRepository.count).mockResolvedValue(5);

    const result = await memoryService.createMemory(
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
      memoryDate: expect.any(Date) as unknown,
      isActive: true,
      embedding: expect.any(Array) as unknown,
      isLongTerm: false,
      relatedMemories: [],
    } as unknown);
    expect(mockRepository.save).toHaveBeenCalledWith(mockMemory as unknown);
    expect(result).toEqual(mockMemory);
  });

  createTest({ name: 'should update memory importance' }, async () => {
    const mockRepository = mockMemoryRepository;

    const mockMemory = {
      id: 1,
      content: 'Test memory',
      importance: MemoryImportanceLevel.AVERAGE,
      characterId: 1,
      type: MemoryType.CONVERSATION,
      metadata: {},
      memoryDate: new Date(),
      isActive: true,
      recallCount: 0,
      lastRecalled: null,
      isLongTerm: false,
      character: null,
      summary: null,
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      relatedMemories: [],
    } as CharacterMemory;

    const updatedMemory = {
      ...mockMemory,
      importance: MemoryImportanceLevel.HIGH,
    } as CharacterMemory;

    (mockRepository.findOne as jest.Mock).mockResolvedValue(mockMemory);
    (mockRepository.save as jest.Mock).mockResolvedValue(updatedMemory);

    const result = await memoryService.updateMemoryImportance(1, MemoryImportanceLevel.HIGH);

    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockRepository.save).toHaveBeenCalledWith(updatedMemory);
    expect(result).toEqual(updatedMemory);
  });

  createTest(
    { name: 'should return null when updating non-existent memory importance' },
    async () => {
      const mockRepository = mockMemoryRepository;

      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await memoryService.updateMemoryImportance(999, MemoryImportanceLevel.HIGH);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(result).toBeNull();
    },
  );
});
