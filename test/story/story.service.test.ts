import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryService, IStoryContext } from '../../src/story/services/story.service';
import {
  StoryEvent,
  IStoryEventTrigger,
  IStoryEventEffect,
  StoryEventType,
} from '../../src/story/entities/story-event.entity';
import { CharacterStoryProgress } from '../../src/story/entities/character-story-progress.entity';
import {
  Character,
  RelationshipStage,
  CharacterGender,
} from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

describe('StoryService', () => {
  let service: StoryService;
  let mockStoryEventRepository: jest.Mocked<Repository<StoryEvent>>;
  let mockProgressRepository: jest.Mocked<Repository<CharacterStoryProgress>>;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;
  let mockNeedRepository: jest.Mocked<Repository<Need>>;
  let mockLogService: MockLogService;

  beforeEach(async () => {
    mockLogService = new MockLogService();

    mockStoryEventRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<StoryEvent>>;

    mockProgressRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<CharacterStoryProgress>>;

    mockCharacterRepository = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Character>>;

    mockNeedRepository = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Need>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryService,
        { provide: getRepositoryToken(StoryEvent), useValue: mockStoryEventRepository },
        { provide: getRepositoryToken(CharacterStoryProgress), useValue: mockProgressRepository },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
        { provide: getRepositoryToken(Need), useValue: mockNeedRepository },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<StoryService>(StoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndTriggerEvents', () => {
    let testCharacter: Character;
    let testContext: IStoryContext;
    let testNeeds: Need[];

    beforeEach(() => {
      testCharacter = {
        id: 1,
        name: 'Test Character',
        age: 25,
        gender: CharacterGender.FEMALE,
        archetype: CharacterArchetype.COMPANION,
        biography: 'Test bio',
        appearance: 'Test appearance',
        personality: {
          traits: ['friendly'],
          hobbies: [],
          fears: [],
          values: [],
          musicTaste: [],
          strengths: [],
          weaknesses: [],
        },
        relationshipStage: RelationshipStage.FRIENDSHIP,
        trust: 60,
        affection: 50,
        energy: 80,
        isActive: true,
      } as Character;

      testNeeds = [
        {
          id: 1,
          characterId: 1,
          type: CharacterNeedType.ATTENTION,
          currentValue: 30,
          maxValue: 100,
          threshold: 40,
          isActive: true,
        } as Need,
      ];

      testContext = {
        character: testCharacter,
        lastUserMessage: 'Hello there!',
        currentNeeds: testNeeds,
        conversationLength: 5,
        timeSinceLastInteraction: 120,
      };
    });

    it('должен загружать потребности персонажа если они не предоставлены', async () => {
      const contextWithoutNeeds = { ...testContext, currentNeeds: undefined };
      mockNeedRepository.find.mockResolvedValue(testNeeds);
      mockStoryEventRepository.find.mockResolvedValue([]);
      mockProgressRepository.find.mockResolvedValue([]);

      await service.checkAndTriggerEvents(contextWithoutNeeds);

      expect(mockNeedRepository.find).toHaveBeenCalledWith({
        where: { characterId: testCharacter.id, isActive: true },
      });
    });

    it('должен активировать событие при выполнении триггеров', async () => {
      const testEvent: StoryEvent = {
        id: 'event-1',
        name: 'Test Event',
        description: 'Test event description',
        eventType: StoryEventType.USER_INTERACTION,
        triggers: {
          specificKeyword: ['hello'],
          trustLevel: { min: 50, max: 70 },
        },
        effects: {
          relationshipChange: 5,
          affectionChange: 3,
        },
        isActive: true,
        isRepeatable: false,
        priority: 1,
        cooldownMinutes: null,
        conditions: {},
        metadata: {},
        characterProgress: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStoryEventRepository.find.mockResolvedValue([testEvent]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          trust: 65, // 60 + 5
          affection: 53, // 50 + 3
        }),
      );
      expect(mockProgressRepository.save).toHaveBeenCalled();
    });

    it('должен пропускать события с невыполненными триггерами', async () => {
      const testEvent: StoryEvent = {
        id: 'event-1',
        name: 'Test Event',
        description: 'Test event description',
        eventType: StoryEventType.USER_INTERACTION,
        triggers: {
          specificKeyword: ['goodbye'], // не соответствует сообщению "Hello there!"
        },
        effects: {
          relationshipChange: 5,
        },
        isActive: true,
        isRepeatable: false,
        priority: 1,
        cooldownMinutes: null,
        conditions: {},
        metadata: {},
        characterProgress: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStoryEventRepository.find.mockResolvedValue([testEvent]);
      mockProgressRepository.find.mockResolvedValue([]);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).not.toHaveBeenCalled();
      expect(mockProgressRepository.save).not.toHaveBeenCalled();
    });

    it('должен ограничивать количество активируемых событий за раз', async () => {
      const events: StoryEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        name: `Test Event ${i}`,
        description: 'Test event description',
        eventType: StoryEventType.USER_INTERACTION,
        triggers: {
          specificKeyword: ['hello'],
        },
        effects: {
          relationshipChange: 1,
        },
        isActive: true,
        isRepeatable: false,
        priority: 1,
        cooldownMinutes: null,
        conditions: {},
        metadata: {},
        characterProgress: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockStoryEventRepository.find.mockResolvedValue(events);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      // Должно быть активировано максимум 3 события
      expect(mockProgressRepository.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('createStoryEvent', () => {
    it('должен создавать новое сюжетное событие', async () => {
      const triggers: IStoryEventTrigger = {
        specificKeyword: ['test'],
        trustLevel: { min: 50 },
      };

      const effects: IStoryEventEffect = {
        relationshipChange: 10,
        addMemory: 'Important test memory',
      };

      const newEvent = {
        id: 'new-event',
        name: 'New Test Event',
        description: 'New event description',
        triggers,
        effects,
        isRepeatable: true,
        isActive: true,
      } as StoryEvent;

      mockStoryEventRepository.create.mockReturnValue(newEvent);
      mockStoryEventRepository.save.mockResolvedValue(newEvent);

      const result = await service.createStoryEvent(
        'New Test Event',
        'New event description',
        triggers,
        effects,
        true,
      );

      expect(mockStoryEventRepository.create).toHaveBeenCalledWith({
        name: 'New Test Event',
        description: 'New event description',
        triggers,
        effects,
        isRepeatable: true,
        isActive: true,
      });
      expect(mockStoryEventRepository.save).toHaveBeenCalledWith(newEvent);
      expect(result).toEqual(newEvent);
    });
  });

  describe('getCharacterStoryProgress', () => {
    it('должен возвращать прогресс персонажа по сюжетным событиям', async () => {
      const mockProgress: CharacterStoryProgress[] = [
        {
          id: 'progress-1',
          character: { id: 1 } as Character,
          storyEvent: { id: 'event-1', name: 'Test Event' } as StoryEvent,
          eventData: { message: 'Event activated' },
          completedAt: new Date(),
        } as CharacterStoryProgress,
      ];

      mockProgressRepository.find.mockResolvedValue(mockProgress);

      const result = await service.getCharacterStoryProgress(1);

      expect(mockProgressRepository.find).toHaveBeenCalledWith({
        where: { character: { id: 1 } },
        relations: ['storyEvent'],
        order: { completedAt: 'DESC' },
      });
      expect(result).toEqual(mockProgress);
    });
  });

  describe('trigger validation', () => {
    let testCharacter: Character;
    let testContext: IStoryContext;

    beforeEach(() => {
      testCharacter = {
        id: 1,
        name: 'Test Character',
        trust: 60,
        affection: 50,
        energy: 80,
        relationshipStage: RelationshipStage.FRIENDSHIP,
      } as Character;

      testContext = {
        character: testCharacter,
        lastUserMessage: 'Hello there!',
        currentNeeds: [
          {
            type: CharacterNeedType.ATTENTION,
            currentValue: 30,
            maxValue: 100,
          } as Need,
        ],
        conversationLength: 5,
        timeSinceLastInteraction: 120,
      };
    });

    it('должен проверять триггеры ключевых слов', async () => {
      const event: StoryEvent = {
        triggers: { specificKeyword: ['hello', 'hi'] },
        effects: {},
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalled();
    });

    it('должен проверять триггеры уровня доверия', async () => {
      const event: StoryEvent = {
        triggers: { trustLevel: { min: 50, max: 70 } },
        effects: {},
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalled();
    });

    it('должен проверять триггеры потребностей', async () => {
      const event: StoryEvent = {
        triggers: {
          needValue: {
            need: CharacterNeedType.ATTENTION,
            min: 20,
            max: 40,
          },
        },
        effects: {},
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalled();
    });
  });

  describe('effects application', () => {
    let testCharacter: Character;
    let testContext: IStoryContext;

    beforeEach(() => {
      testCharacter = {
        id: 1,
        name: 'Test Character',
        trust: 60,
        affection: 50,
        energy: 80,
        relationshipStage: RelationshipStage.FRIENDSHIP,
        personality: {
          traits: ['friendly'],
          hobbies: [],
          fears: [],
          values: [],
          musicTaste: [],
          strengths: [],
          weaknesses: [],
        },
      } as Character;

      testContext = {
        character: testCharacter,
        currentNeeds: [
          {
            id: 1,
            type: CharacterNeedType.ATTENTION,
            currentValue: 30,
            maxValue: 100,
          } as Need,
        ],
      };
    });

    it('должен применять эффекты изменения личности', async () => {
      const event: StoryEvent = {
        triggers: {},
        effects: {
          personalityChange: {
            addTrait: ['caring'],
            removeTrait: ['friendly'],
          },
        },
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          personality: expect.objectContaining({
            traits: expect.arrayContaining(['caring']) as unknown,
          }) as unknown,
        }) as unknown,
      );
    });

    it('должен применять эффекты изменения потребностей', async () => {
      const event: StoryEvent = {
        triggers: {},
        effects: {
          needChange: [{ need: CharacterNeedType.ATTENTION, value: 20 }],
        },
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);
      mockNeedRepository.save.mockResolvedValue({} as Need);

      await service.checkAndTriggerEvents(testContext);

      expect(mockNeedRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentValue: 50, // 30 + 20
        }),
      );
    });

    it('должен ограничивать значения в допустимых пределах', async () => {
      testCharacter.trust = 95;
      testCharacter.affection = 5;

      const event: StoryEvent = {
        triggers: {},
        effects: {
          relationshipChange: 10, // должно ограничиться до 100
          affectionChange: -10, // должно ограничиться до 0
        },
      } as StoryEvent;

      mockStoryEventRepository.find.mockResolvedValue([event]);
      mockProgressRepository.find.mockResolvedValue([]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      await service.checkAndTriggerEvents(testContext);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          trust: 100, // ограничено максимумом
          affection: 0, // ограничено минимумом
        }),
      );
    });
  });
});
