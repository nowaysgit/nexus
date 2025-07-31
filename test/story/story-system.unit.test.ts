import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryService } from '../../src/story/services/story.service';
import { StoryAutomationService } from '../../src/story/services/story-automation.service';
import { StoryEvent, StoryEventType } from '../../src/story/entities/story-event.entity';
import { CharacterStoryProgress } from '../../src/story/entities/character-story-progress.entity';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { Need } from '../../src/character/entities/need.entity';
import { CharacterNeedType } from '../../src/character/enums/character-need-type.enum';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { LogService } from '../../src/logging/log.service';
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

describe('Story System Unit Tests', () => {
  let storyService: StoryService;
  let storyAutomationService: StoryAutomationService;
  let mockStoryEventRepository: jest.Mocked<Repository<StoryEvent>>;
  let mockProgressRepository: jest.Mocked<Repository<CharacterStoryProgress>>;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;
  let mockNeedRepository: jest.Mocked<Repository<Need>>;
  let mockDialogRepository: jest.Mocked<Repository<Dialog>>;
  let mockMessageRepository: jest.Mocked<Repository<Message>>;
  let mockLogService: MockLogService;

  beforeEach(async () => {
    mockLogService = new MockLogService();

    // Создаем моки для всех репозиториев
    mockStoryEventRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<StoryEvent>>;

    mockProgressRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<CharacterStoryProgress>>;

    mockCharacterRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Character>>;

    mockNeedRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Need>>;

    mockDialogRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Dialog>>;

    mockMessageRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Message>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryService,
        StoryAutomationService,
        { provide: getRepositoryToken(StoryEvent), useValue: mockStoryEventRepository },
        { provide: getRepositoryToken(CharacterStoryProgress), useValue: mockProgressRepository },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
        { provide: getRepositoryToken(Need), useValue: mockNeedRepository },
        { provide: getRepositoryToken(Dialog), useValue: mockDialogRepository },
        { provide: getRepositoryToken(Message), useValue: mockMessageRepository },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    storyService = module.get<StoryService>(StoryService);
    storyAutomationService = module.get<StoryAutomationService>(StoryAutomationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Интеграция StoryService и StoryAutomationService', () => {
    it('должен создавать стандартные события через автоматизацию', async () => {
      mockStoryEventRepository.create.mockImplementation(data => data as StoryEvent);
      mockStoryEventRepository.save.mockImplementation(event =>
        Promise.resolve(event as StoryEvent),
      );

      await storyAutomationService.initializeDefaultEvents();

      expect(mockStoryEventRepository.save).toHaveBeenCalledTimes(5);

      // Проверяем, что создаются правильные события
      const savedEvents = mockStoryEventRepository.save.mock.calls.map(call => call[0]);
      const eventNames = savedEvents.map(event => event.name);

      expect(eventNames).toContain('Чувство одиночества');
      expect(eventNames).toContain('Радость от общения');
      expect(eventNames).toContain('Углубление отношений');
      expect(eventNames).toContain('Накопление фрустрации');
      expect(eventNames).toContain('Восстановление энергии');
    });

    it('должен создавать персонализированные события для разных архетипов', async () => {
      const testCharacters = [
        {
          id: 1,
          name: 'Компаньон',
          archetype: CharacterArchetype.COMPANION,
          needs: [],
        },
        {
          id: 2,
          name: 'Ментор',
          archetype: CharacterArchetype.MENTOR,
          needs: [],
        },
        {
          id: 3,
          name: 'Бунтарь',
          archetype: CharacterArchetype.REBEL,
          needs: [],
        },
      ];

      mockCharacterRepository.findOne
        .mockResolvedValueOnce(testCharacters[0] as Character)
        .mockResolvedValueOnce(testCharacters[1] as Character)
        .mockResolvedValueOnce(testCharacters[2] as Character);

      mockStoryEventRepository.create.mockImplementation(data => data as StoryEvent);
      mockStoryEventRepository.save.mockImplementation(event =>
        Promise.resolve(event as StoryEvent),
      );

      // Создаем персонализированные события для каждого архетипа
      for (const character of testCharacters) {
        await storyAutomationService.createPersonalizedEvents(character.id);
      }

      expect(mockStoryEventRepository.save).toHaveBeenCalledTimes(3);

      const savedEvents = mockStoryEventRepository.save.mock.calls.map(call => call[0]);
      const eventNames = savedEvents.map(event => event.name);

      expect(eventNames.some(name => name.includes('Желание поддержать'))).toBe(true);
      expect(eventNames.some(name => name.includes('Желание научить'))).toBe(true);
      expect(eventNames.some(name => name.includes('Вызов конформности'))).toBe(true);
    });

    it('должен правильно обрабатывать автоматические события', async () => {
      const testCharacters = [
        {
          id: 1,
          name: 'Character 1',
          isActive: true,
          archetype: CharacterArchetype.COMPANION,
          dialogs: [],
          needs: [],
        },
        {
          id: 2,
          name: 'Character 2',
          isActive: true,
          archetype: CharacterArchetype.MENTOR,
          dialogs: [],
          needs: [],
        },
      ];

      mockCharacterRepository.find.mockResolvedValue(testCharacters as Character[]);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.find.mockResolvedValue([]);
      mockMessageRepository.findOne.mockResolvedValue(null);

      // Мокаем методы StoryService
      jest.spyOn(storyService, 'checkAndTriggerEvents').mockResolvedValue(undefined);

      await storyAutomationService.processAutomaticEvents();

      expect(mockCharacterRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: ['dialogs', 'needs'],
      });
      expect(storyService.checkAndTriggerEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('Проверка триггеров событий', () => {
    let testCharacter: Character;
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
          traits: ['дружелюбная'],
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
          currentValue: 25,
          maxValue: 100,
          threshold: 40,
          isActive: true,
        } as Need,
      ];
    });

    it('должен активировать событие при выполнении триггеров ключевых слов', async () => {
      const testEvent: StoryEvent = {
        id: 'event-1',
        name: 'Реакция на привет',
        description: 'Персонаж реагирует на приветствие',
        eventType: StoryEventType.USER_INTERACTION,
        triggers: {
          specificKeyword: ['привет', 'hello'],
        },
        effects: {
          affectionChange: 5,
          addMemory: 'Пользователь поприветствовал меня',
        },
        isActive: true,
        isRepeatable: true,
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
      mockNeedRepository.find.mockResolvedValue(testNeeds);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Привет, как дела?',
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          affection: 55, // 50 + 5
        }),
      );
      expect(mockProgressRepository.save).toHaveBeenCalled();
    });

    it('должен активировать событие при выполнении триггеров потребностей', async () => {
      const testEvent: StoryEvent = {
        id: 'event-2',
        name: 'Низкое внимание',
        description: 'Персонаж нуждается во внимании',
        eventType: StoryEventType.EMOTIONAL,
        triggers: {
          needValue: {
            need: CharacterNeedType.ATTENTION,
            min: 0,
            max: 30,
          },
        },
        effects: {
          sendMessage: {
            text: 'Мне нужно больше внимания!',
            delay: 0,
          },
        },
        isActive: true,
        isRepeatable: true,
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
      mockNeedRepository.find.mockResolvedValue(testNeeds);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Как дела?',
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockProgressRepository.save).toHaveBeenCalled();
    });

    it('должен активировать событие при выполнении триггеров доверия', async () => {
      const testEvent: StoryEvent = {
        id: 'event-3',
        name: 'Высокое доверие',
        description: 'Персонаж доверяет пользователю',
        eventType: StoryEventType.RELATIONSHIP,
        triggers: {
          trustLevel: { min: 50, max: 70 },
        },
        effects: {
          relationshipStageChange: 30, // достаточно для перехода с FRIENDSHIP (30) на ROMANCE (60)
          addMemory: 'Я начинаю больше доверять пользователю',
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
      mockNeedRepository.find.mockResolvedValue(testNeeds);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Расскажи о себе',
        conversationLength: 3,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipStage: RelationshipStage.ROMANCE, // переход с FRIENDSHIP на ROMANCE
        }),
      );
      expect(mockProgressRepository.save).toHaveBeenCalled();
    });
  });

  describe('Применение эффектов событий', () => {
    let testCharacter: Character;
    let testNeed: Need;

    beforeEach(() => {
      testCharacter = {
        id: 1,
        name: 'Test Character',
        trust: 50,
        affection: 50,
        energy: 80,
        relationshipStage: RelationshipStage.FRIENDSHIP,
        personality: {
          traits: ['дружелюбная'],
          hobbies: [],
          fears: [],
          values: [],
          musicTaste: [],
          strengths: [],
          weaknesses: [],
        },
      } as Character;

      testNeed = {
        id: 1,
        characterId: 1,
        type: CharacterNeedType.ATTENTION,
        currentValue: 30,
        maxValue: 100,
        threshold: 40,
        isActive: true,
      } as Need;
    });

    it('должен правильно применять эффекты изменения характеристик', async () => {
      const testEvent: StoryEvent = {
        id: 'event-1',
        name: 'Тестовое событие',
        description: 'Событие для проверки эффектов',
        eventType: StoryEventType.USER_INTERACTION,
        triggers: {},
        effects: {
          relationshipChange: 10,
          affectionChange: 5,
          energyChange: -10,
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
      mockNeedRepository.find.mockResolvedValue([testNeed]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Test message',
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          trust: 60, // 50 + 10
          affection: 55, // 50 + 5
          energy: 70, // 80 - 10
        }),
      );
    });

    it('должен правильно применять эффекты изменения личности', async () => {
      const testEvent: StoryEvent = {
        id: 'event-2',
        name: 'Изменение личности',
        description: 'Событие для изменения черт личности',
        eventType: StoryEventType.PERSONAL_GROWTH,
        triggers: {},
        effects: {
          personalityChange: {
            addTrait: ['счастливая'],
            removeTrait: ['дружелюбная'],
          },
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
      mockNeedRepository.find.mockResolvedValue([testNeed]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Test message',
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockCharacterRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          personality: expect.objectContaining({
            traits: expect.arrayContaining(['счастливая']) as unknown,
          }) as unknown,
        }) as unknown,
      );
    });

    it('должен правильно применять эффекты изменения потребностей', async () => {
      const testEvent: StoryEvent = {
        id: 'event-3',
        name: 'Изменение потребностей',
        description: 'Событие для изменения потребностей',
        eventType: StoryEventType.NEED_FULFILLMENT,
        triggers: {},
        effects: {
          needChange: [{ need: CharacterNeedType.ATTENTION, value: 20 }],
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
      mockNeedRepository.find.mockResolvedValue([testNeed]);
      mockCharacterRepository.save.mockResolvedValue(testCharacter);
      mockNeedRepository.save.mockResolvedValue(testNeed);
      mockProgressRepository.create.mockReturnValue({} as CharacterStoryProgress);
      mockProgressRepository.save.mockResolvedValue({} as CharacterStoryProgress);

      const context = {
        character: testCharacter,
        lastUserMessage: 'Test message',
        conversationLength: 1,
        timeSinceLastInteraction: 0,
      };

      await storyService.checkAndTriggerEvents(context);

      expect(mockNeedRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentValue: 50, // 30 + 20
        }),
      );
    });
  });
});
