import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CharacterManagementService,
  ICharacterAnalysis,
} from '../../../src/character/services/core/character-management.service';
import { Character, PersonalityData } from '../../../src/character/entities/character.entity';
import {
  CharacterMemory,
  MemoryImportanceLevel,
} from '../../../src/character/entities/character-memory.entity';
import { Need } from '../../../src/character/entities/need.entity';
import { Action, ActionStatus } from '../../../src/character/entities/action.entity';
import { StoryEvent, EventType } from '../../../src/character/entities/story-event.entity';
import {
  CreateCharacterDto,
  PersonalityDataDto,
} from '../../../src/character/dto/create-character.dto';
import { CacheService } from '../../../src/cache/cache.service';
import { LogService } from '../../../src/logging/log.service';
import { CharacterNeedType } from '../../../src/character/enums/character-need-type.enum';
import { CharacterArchetype } from '../../../src/character/enums/character-archetype.enum';
import { ActionType } from '../../../src/character/enums/action-type.enum';

describe('CharacterManagementService', () => {
  let service: CharacterManagementService;
  let characterRepository: jest.Mocked<Repository<Character>>;
  let memoryRepository: jest.Mocked<Repository<CharacterMemory>>;
  let needRepository: jest.Mocked<Repository<Need>>;
  let actionRepository: jest.Mocked<Repository<Action>>;
  let storyEventRepository: jest.Mocked<Repository<StoryEvent>>;
  let cacheService: jest.Mocked<CacheService>;
  let logService: jest.Mocked<LogService>;

  // Упрощенные тестовые данные
  const mockPersonality: PersonalityData = {
    traits: ['friendly', 'helpful'],
    hobbies: ['reading', 'music'],
    fears: ['darkness'],
    values: ['honesty', 'loyalty'],
    musicTaste: ['rock', 'jazz'],
    strengths: ['empathy', 'intelligence'],
    weaknesses: ['impatience'],
  };

  const mockCharacter = {
    id: 1,
    name: 'Test Character',
    fullName: 'Test Character Full',
    age: 25,
    gender: 'female',
    archetype: CharacterArchetype.HERO,
    biography: 'A test character',
    appearance: 'Tall and strong',
    personality: mockPersonality,
    psychologicalProfile: null,
    preferences: null,
    idealPartner: null,
    knowledgeAreas: [],
    relationshipStage: 'acquaintance',
    developmentStage: 'initial',
    affection: 50,
    trust: 50,
    energy: 100,
    isActive: true,
    isArchived: false,
    user: null,
    userId: '123',
    needs: [],
    dialogs: [],
    memories: [],
    actions: [],
    motivations: [],
    storyProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastInteraction: new Date(),
  } as Character;

  const mockCreateCharacterDto: CreateCharacterDto = {
    name: 'New Character',
    archetype: CharacterArchetype.HERO,
    personality: {
      traits: ['brave', 'loyal'],
      hobbies: ['sports'],
      fears: ['heights'],
      values: ['courage'],
      musicTaste: ['classical'],
      strengths: ['determination'],
      weaknesses: ['stubbornness'],
    } as PersonalityDataDto,
    appearance: 'Athletic build',
  };

  const mockNeeds = [
    {
      id: 1,
      characterId: 1,
      type: CharacterNeedType.SOCIAL_CONNECTION,
      currentValue: 75,
      maxValue: 100,
      growthRate: 1,
      decayRate: 0.5,
      threshold: 50,
      priority: 5,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
    } as Need,
    {
      id: 2,
      characterId: 1,
      type: CharacterNeedType.ATTENTION,
      currentValue: 20,
      maxValue: 100,
      growthRate: 1,
      decayRate: 0.5,
      threshold: 50,
      priority: 5,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
    } as Need,
  ];

  const mockMemories = [
    {
      id: 1,
      characterId: 1,
      content: 'Important memory',
      importance: MemoryImportanceLevel.VERY_HIGH,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CharacterMemory,
    {
      id: 2,
      characterId: 1,
      content: 'Recent memory',
      importance: MemoryImportanceLevel.ABOVE_AVERAGE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CharacterMemory,
  ];

  const mockActions = [
    {
      id: 1,
      characterId: 1,
      type: ActionType.SEND_MESSAGE,
      description: 'Sent a message',
      status: ActionStatus.COMPLETED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Action,
    {
      id: 2,
      characterId: 1,
      type: ActionType.EXPRESS_EMOTION,
      description: 'Expressed joy',
      status: ActionStatus.COMPLETED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Action,
  ];

  beforeEach(async () => {
    // Создаем моки для всех зависимостей
    const mockCharacterRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockMemoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockNeedRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockActionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockStoryEventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockLogService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterManagementService,
        {
          provide: getRepositoryToken(Character),
          useValue: mockCharacterRepository,
        },
        {
          provide: getRepositoryToken(CharacterMemory),
          useValue: mockMemoryRepository,
        },
        {
          provide: getRepositoryToken(Need),
          useValue: mockNeedRepository,
        },
        {
          provide: getRepositoryToken(Action),
          useValue: mockActionRepository,
        },
        {
          provide: getRepositoryToken(StoryEvent),
          useValue: mockStoryEventRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compile();

    service = module.get<CharacterManagementService>(CharacterManagementService);
    characterRepository = module.get(getRepositoryToken(Character));
    memoryRepository = module.get(getRepositoryToken(CharacterMemory));
    needRepository = module.get(getRepositoryToken(Need));
    actionRepository = module.get(getRepositoryToken(Action));
    storyEventRepository = module.get(getRepositoryToken(StoryEvent));
    cacheService = module.get(CacheService);
    logService = module.get(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCharacter', () => {
    it('должен создать персонажа с базовыми настройками', async () => {
      const userId = 123;
      const expectedCharacter = { ...mockCharacter, userId: '123' };

      characterRepository.create.mockReturnValue(expectedCharacter);
      characterRepository.save.mockResolvedValue(expectedCharacter);
      needRepository.create.mockReturnValue({} as Need);
      needRepository.save.mockResolvedValue({} as Need);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.createCharacter(mockCreateCharacterDto, userId);

      expect(characterRepository.create).toHaveBeenCalledWith({
        ...mockCreateCharacterDto,
        userId: '123',
        isActive: true,
        createdAt: expect.any(Date),
      });
      expect(characterRepository.save).toHaveBeenCalledWith(expectedCharacter);
      expect(needRepository.create).toHaveBeenCalledTimes(4); // 4 базовые потребности
      expect(needRepository.save).toHaveBeenCalledTimes(4);
      expect(cacheService.set).toHaveBeenCalledWith(
        `character:${expectedCharacter.id}`,
        expectedCharacter,
        3600,
      );
      expect(result).toEqual(expectedCharacter);
    });

    it('должен инициализировать базовые потребности', async () => {
      const userId = 123;
      const expectedCharacter = { ...mockCharacter, id: 1 };

      characterRepository.create.mockReturnValue(expectedCharacter);
      characterRepository.save.mockResolvedValue(expectedCharacter);
      needRepository.create.mockReturnValue({} as Need);
      needRepository.save.mockResolvedValue({} as Need);
      cacheService.set.mockResolvedValue(undefined);

      await service.createCharacter(mockCreateCharacterDto, userId);

      // Проверяем, что созданы все 4 базовые потребности
      expect(needRepository.create).toHaveBeenCalledWith({
        characterId: 1,
        type: 'SOCIAL',
        currentValue: 50,
        maxValue: 100,
        growthRate: 1,
        decayRate: 0.5,
        threshold: 50,
        priority: 5,
        isActive: true,
      });
    });

    it('должен обрабатывать ошибки при создании персонажа', async () => {
      const userId = 123;
      const error = new Error('Database error');

      characterRepository.save.mockRejectedValue(error);

      await expect(service.createCharacter(mockCreateCharacterDto, userId)).rejects.toThrow();
    });
  });

  describe('getCharacterWithData', () => {
    it('должен возвращать персонажа из кэша', async () => {
      const characterId = '1';
      cacheService.get.mockResolvedValue(mockCharacter);

      const result = await service.getCharacterWithData(characterId);

      expect(cacheService.get).toHaveBeenCalledWith(`character:${characterId}`);
      expect(characterRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockCharacter);
    });

    it('должен загружать персонажа из БД, если не найден в кэше', async () => {
      const characterId = '1';
      const characterWithRelations = {
        ...mockCharacter,
        needs: mockNeeds,
        memories: mockMemories,
        actions: mockActions,
      };

      cacheService.get.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(characterWithRelations);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getCharacterWithData(characterId);

      expect(cacheService.get).toHaveBeenCalledWith(`character:${characterId}`);
      expect(characterRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['needs', 'memories', 'actions', 'storyEvents'],
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        `character:${characterId}`,
        characterWithRelations,
        3600,
      );
      expect(result).toEqual(characterWithRelations);
    });

    it('должен возвращать null, если персонаж не найден', async () => {
      const characterId = '999';
      cacheService.get.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(null);

      const result = await service.getCharacterWithData(characterId);

      expect(result).toBeNull();
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('createStoryEvent', () => {
    it('должен создать сюжетное событие', async () => {
      const characterId = '1';
      const eventType = 'RELATIONSHIP_MILESTONE';
      const description = 'Character reached a milestone';
      const expectedStoryEvent = {
        id: 1,
        characterId: 1,
        type: EventType.RELATIONSHIP_MILESTONE,
        title: description,
        description,
        triggers: {},
        effects: undefined,
      } as StoryEvent;

      storyEventRepository.create.mockReturnValue(expectedStoryEvent);
      storyEventRepository.save.mockResolvedValue(expectedStoryEvent);
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.createStoryEvent(characterId, eventType, description);

      expect(storyEventRepository.create).toHaveBeenCalledWith({
        characterId: 1,
        type: eventType as EventType,
        title: description,
        description,
        triggers: {},
        effects: undefined,
      });
      expect(storyEventRepository.save).toHaveBeenCalledWith(expectedStoryEvent);
      expect(cacheService.del).toHaveBeenCalledWith(`character:${characterId}`);
      expect(result).toEqual(expectedStoryEvent);
    });

    it('должен обрабатывать ошибки при создании события', async () => {
      const characterId = '1';
      const eventType = 'RELATIONSHIP_MILESTONE';
      const description = 'Test event';
      const error = new Error('Database error');

      storyEventRepository.save.mockRejectedValue(error);

      await expect(service.createStoryEvent(characterId, eventType, description)).rejects.toThrow();
    });
  });

  describe('getCharacterAnalysis', () => {
    it('должен возвращать полный анализ персонажа', async () => {
      const characterId = '1';
      const characterWithData = {
        ...mockCharacter,
        needs: mockNeeds,
        memories: mockMemories,
        actions: mockActions,
      };

      cacheService.get.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(characterWithData);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getCharacterAnalysis(characterId);

      expect(result).toEqual({
        characterId,
        needsAnalysis: {
          needsByType: {
            [CharacterNeedType.SOCIAL_CONNECTION]: 75,
            [CharacterNeedType.ATTENTION]: 20,
          },
          averageValue: 47.5,
          criticalNeeds: [CharacterNeedType.ATTENTION],
          overallSatisfaction: 'LOW',
        },
        memoriesAnalysis: {
          totalMemories: 2,
          averageImportance: 7.5, // (9 + 6) / 2
          importantMemoriesCount: 0,
          recentMemoriesCount: 2,
          memoryRetention: 'ACTIVE',
        },
        activityAnalysis: {
          totalActions: 2,
          actionsByType: {
            [ActionType.SEND_MESSAGE]: 1,
            [ActionType.EXPRESS_EMOTION]: 1,
          },
          recentActionsCount: 2,
          activityLevel: 'LOW',
        },
        overallState: 'POOR',
        createdAt: expect.any(Date),
      });
    });

    it('должен выбрасывать ошибку, если персонаж не найден', async () => {
      const characterId = '999';
      cacheService.get.mockResolvedValue(null);
      characterRepository.findOne.mockResolvedValue(null);

      await expect(service.getCharacterAnalysis(characterId)).rejects.toThrow(
        'Character not found',
      );
    });
  });

  describe('error handling', () => {
    it('должен корректно обрабатывать ошибки в withErrorHandling', async () => {
      const characterId = '1';
      const error = new Error('Test error');

      cacheService.get.mockRejectedValue(error);

      await expect(service.getCharacterWithData(characterId)).rejects.toThrow();
    });
  });
});
