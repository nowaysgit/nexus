import { getRepositoryToken } from '@nestjs/typeorm';
import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { CharacterManagementService } from '../../src/character/services/character-management.service';
import { LogService } from '../../src/logging/log.service';
import { CacheService } from '../../src/cache/cache.service';
import { ErrorHandlingService } from '../../src/common/utils/error-handling/error-handling.service';
import { Character } from '../../src/character/entities/character.entity';
import { CharacterMemory } from '../../src/character/entities/character-memory.entity';
import { Need } from '../../src/character/entities/need.entity';
import { Action } from '../../src/character/entities/action.entity';
import { StoryEvent } from '../../src/character/entities/story-event.entity';
import { CreateCharacterDto } from '../../src/character/dto/create-character.dto';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';

createTestSuite('CharacterManagementService Unit Tests', () => {
  const mockLogService = {
    log: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockErrorHandlingService = {
    handleError: jest.fn(),
  };

  const mockCharacterRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockNeedRepository = {
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockActionRepository = {
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockStoryEventRepository = {
    save: jest.fn(),
    create: jest.fn(),
  };

  const providers = [
    CharacterManagementService,
    { provide: LogService, useValue: mockLogService },
    { provide: CacheService, useValue: mockCacheService },
    { provide: ErrorHandlingService, useValue: mockErrorHandlingService },
    {
      provide: getRepositoryToken(Character),
      useValue: mockCharacterRepository,
    },
    {
      provide: getRepositoryToken(Need),
      useValue: mockNeedRepository,
    },
    {
      provide: getRepositoryToken(CharacterMemory),
      useValue: {},
    },
    {
      provide: getRepositoryToken(Action),
      useValue: mockActionRepository,
    },
    {
      provide: getRepositoryToken(StoryEvent),
      useValue: mockStoryEventRepository,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'should create a character with basic settings',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterManagementService);

      const createDto: CreateCharacterDto = {
        archetype: CharacterArchetype.HERO,
        fullName: 'Test Character',
        biography: 'Test Bio',
      };
      const userId = 1;
      const mockCharacter = { id: 1, ...createDto, userId, isActive: true };

      mockCharacterRepository.create.mockReturnValue(mockCharacter);
      mockCharacterRepository.save.mockResolvedValue(mockCharacter);
      mockNeedRepository.create.mockReturnValue({});
      mockNeedRepository.save.mockResolvedValue({});
      const result = await service.createCharacter(createDto, userId);

      expect(result).toEqual(mockCharacter);
      expect(mockCharacterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          userId,
        }),
      );
      expect(mockCharacterRepository.save).toHaveBeenCalledWith(mockCharacter);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `character:${mockCharacter.id}`,
        mockCharacter,
        3600,
      );
    },
  );

  createTest(
    {
      name: 'should get a character with full data from cache',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterManagementService);
      const characterId = 1;
      const mockCharacter = { id: characterId, fullName: 'Test Character' };

      mockCacheService.get.mockResolvedValue(mockCharacter);

      const result = await service.getCharacterWithData(characterId.toString());

      expect(result).toEqual(mockCharacter);
      expect(mockCacheService.get).toHaveBeenCalledWith(`character:${characterId}`);
      expect(mockCharacterRepository.findOne).not.toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'should get a character with full data from db if not in cache',
      configType: TestConfigType.BASIC,
      providers,
    },
    async context => {
      const service = context.get(CharacterManagementService);
      const characterId = 1;
      const mockCharacter = { id: characterId, fullName: 'Test Character' };

      mockCacheService.get.mockResolvedValue(null);
      mockCharacterRepository.findOne.mockResolvedValue(mockCharacter);

      const result = await service.getCharacterWithData(characterId.toString());

      expect(result).toEqual(mockCharacter);
      expect(mockCacheService.get).toHaveBeenCalledWith(`character:${characterId}`);
      expect(mockCharacterRepository.findOne).toHaveBeenCalledWith({
        where: { id: characterId },
        relations: ['needs', 'memories', 'actions', 'storyEvents'],
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `character:${characterId}`,
        mockCharacter,
        3600,
      );
    },
  );
});
