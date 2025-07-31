import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryAutomationService } from '../../src/story/services/story-automation.service';
import { StoryService, IStoryContext } from '../../src/story/services/story.service';
import {
  Character,
  CharacterGender,
  RelationshipStage,
} from '../../src/character/entities/character.entity';
import { CharacterArchetype } from '../../src/character/enums/character-archetype.enum';
import { Dialog } from '../../src/dialog/entities/dialog.entity';
import { Message } from '../../src/dialog/entities/message.entity';
import { Need } from '../../src/character/entities/need.entity';
import { StoryEvent, StoryEventType } from '../../src/story/entities/story-event.entity';
import { LogService } from '../../src/logging/log.service';

function createMockStoryEvent(partial: Partial<StoryEvent> = {}): StoryEvent {
  return {
    id: 'mock-story-event-id',
    name: 'Mock Story Event',
    description: 'Mock story event description',
    eventType: StoryEventType.USER_INTERACTION,
    triggers: {},
    effects: {},
    isActive: true,
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as StoryEvent;
}
import { MockLogService } from '../../lib/tester/mocks/log.service.mock';

describe('StoryAutomationService', () => {
  let service: StoryAutomationService;
  let mockStoryService: jest.Mocked<StoryService>;
  let mockCharacterRepository: jest.Mocked<Repository<Character>>;
  let mockDialogRepository: jest.Mocked<Repository<Dialog>>;
  let mockMessageRepository: jest.Mocked<Repository<Message>>;
  let mockNeedRepository: jest.Mocked<Repository<Need>>;
  let mockLogService: MockLogService;

  beforeEach(async () => {
    mockLogService = new MockLogService();

    mockStoryService = {
      checkAndTriggerEvents: jest.fn(),
      createStoryEvent: jest.fn(),
      getCharacterStoryProgress: jest.fn(),
    } as unknown as jest.Mocked<StoryService>;

    mockCharacterRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Character>>;

    mockDialogRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Dialog>>;

    mockMessageRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Message>>;

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
        StoryAutomationService,
        { provide: StoryService, useValue: mockStoryService },
        { provide: getRepositoryToken(Character), useValue: mockCharacterRepository },
        { provide: getRepositoryToken(Dialog), useValue: mockDialogRepository },
        { provide: getRepositoryToken(Message), useValue: mockMessageRepository },
        { provide: getRepositoryToken(Need), useValue: mockNeedRepository },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<StoryAutomationService>(StoryAutomationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAutomaticEvents', () => {
    it('должен обрабатывать всех активных персонажей', async () => {
      const testCharacters: Character[] = [
        {
          id: 1,
          name: 'Character 1',
          isActive: true,
          archetype: CharacterArchetype.COMPANION,
          dialogs: [],
          needs: [],
        } as Character,
        {
          id: 2,
          name: 'Character 2',
          isActive: true,
          archetype: CharacterArchetype.MENTOR,
          dialogs: [],
          needs: [],
        } as Character,
      ];

      mockCharacterRepository.find.mockResolvedValue(testCharacters);
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.find.mockResolvedValue([]);
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockStoryService.checkAndTriggerEvents.mockResolvedValue(undefined);

      await service.processAutomaticEvents();

      expect(mockCharacterRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: ['dialogs', 'needs'],
      });
      expect(mockStoryService.checkAndTriggerEvents).toHaveBeenCalledTimes(2);
    });

    it('должен обрабатывать ошибки для отдельных персонажей', async () => {
      const testCharacters: Character[] = [
        {
          id: 1,
          name: 'Character 1',
          isActive: true,
          archetype: CharacterArchetype.COMPANION,
        } as Character,
      ];

      mockCharacterRepository.find.mockResolvedValue(testCharacters);
      mockDialogRepository.findOne.mockRejectedValue(new Error('Database error'));

      await service.processAutomaticEvents();

      expect(mockLogService.winstonLogger.error).toHaveBeenCalled();
    });
  });

  describe('checkCharacterForEvents', () => {
    let testCharacter: Character;

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
    });

    it('должен формировать правильный контекст для проверки событий', async () => {
      const testMessages: Message[] = [
        {
          id: 1,
          content: 'Hello there!',
          createdAt: new Date(),
          updatedAt: new Date(),
          dialogId: 1,
          userId: 1,
          characterId: null,
          isFromUser: true,
        } as Message,
      ];

      mockDialogRepository.findOne.mockResolvedValue({} as Dialog);
      mockMessageRepository.find.mockResolvedValue(testMessages);
      mockMessageRepository.findOne.mockResolvedValue(testMessages[0]);
      mockStoryService.checkAndTriggerEvents.mockResolvedValue(undefined);

      await service.checkCharacterForEvents(testCharacter);

      expect(mockStoryService.checkAndTriggerEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          character: testCharacter,
          lastUserMessage: 'Hello there!',
          conversationLength: 1,
          timeSinceLastInteraction: expect.any(Number) as number,
        }) as IStoryContext,
      );
    });

    it('должен обрабатывать персонажа без сообщений', async () => {
      mockDialogRepository.findOne.mockResolvedValue(null);
      mockMessageRepository.find.mockResolvedValue([]);
      mockMessageRepository.findOne.mockResolvedValue(null);
      mockStoryService.checkAndTriggerEvents.mockResolvedValue(undefined);

      await service.checkCharacterForEvents(testCharacter);

      expect(mockStoryService.checkAndTriggerEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          character: testCharacter,
          lastUserMessage: undefined,
          conversationLength: 0,
          timeSinceLastInteraction: 0,
        }),
      );
    });
  });

  describe('initializeDefaultEvents', () => {
    it('должен создавать стандартные события', async () => {
      mockStoryService.createStoryEvent.mockResolvedValue(createMockStoryEvent());

      await service.initializeDefaultEvents();

      expect(mockStoryService.createStoryEvent).toHaveBeenCalledTimes(5);

      // Проверяем, что создаются правильные события
      const calls = mockStoryService.createStoryEvent.mock.calls;
      const eventNames = calls.map(call => call[0]);

      expect(eventNames).toContain('Чувство одиночества');
      expect(eventNames).toContain('Радость от общения');
      expect(eventNames).toContain('Углубление отношений');
      expect(eventNames).toContain('Накопление фрустрации');
      expect(eventNames).toContain('Восстановление энергии');
    });

    it('должен обрабатывать ошибки при создании дублирующихся событий', async () => {
      mockStoryService.createStoryEvent.mockRejectedValue(new Error('Event already exists'));

      await service.initializeDefaultEvents();

      expect(mockLogService.winstonLogger.warn).toHaveBeenCalled();
    });
  });

  describe('createPersonalizedEvents', () => {
    it('должен создавать персонализированные события для компаньона', async () => {
      const testCharacter: Character = {
        id: 1,
        name: 'Companion Character',
        archetype: CharacterArchetype.COMPANION,
        needs: [],
      } as Character;

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockStoryService.createStoryEvent.mockResolvedValue(createMockStoryEvent());

      await service.createPersonalizedEvents(1);

      expect(mockStoryService.createStoryEvent).toHaveBeenCalledWith(
        'Companion Character: Желание поддержать',
        'Компаньон хочет оказать эмоциональную поддержку',
        expect.objectContaining({
          emotionalState: { required: ['sad', 'frustrated', 'angry'] },
        }),
        expect.objectContaining({
          sendMessage: expect.objectContaining({
            text: 'Я вижу, что тебе непросто. Хочешь поговорить об этом?',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
        true,
      );
    });

    it('должен создавать персонализированные события для ментора', async () => {
      const testCharacter: Character = {
        id: 1,
        name: 'Mentor Character',
        archetype: CharacterArchetype.MENTOR,
        needs: [],
      } as Character;

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockStoryService.createStoryEvent.mockResolvedValue(createMockStoryEvent());

      await service.createPersonalizedEvents(1);

      expect(mockStoryService.createStoryEvent).toHaveBeenCalledWith(
        'Mentor Character: Желание научить',
        'Ментор хочет поделиться знаниями',
        expect.objectContaining({
          conversationLength: 3,
          trustLevel: { min: 40 },
        }),
        expect.objectContaining({
          sendMessage: expect.objectContaining({
            text: 'У меня есть интересная мысль, которой хочу поделиться...',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
        true,
      );
    });

    it('должен выбрасывать ошибку для несуществующего персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(null);

      await expect(service.createPersonalizedEvents(999)).rejects.toThrow(
        'Персонаж с ID 999 не найден',
      );
    });
  });

  describe('triggerEventForCharacter', () => {
    it('должен принудительно активировать событие для персонажа', async () => {
      const testCharacter: Character = {
        id: 1,
        name: 'Test Character',
      } as Character;

      mockCharacterRepository.findOne.mockResolvedValue(testCharacter);
      mockStoryService.checkAndTriggerEvents.mockResolvedValue(undefined);

      const result = await service.triggerEventForCharacter(1, 'Test Event');

      expect(result).toBe(true);
      expect(mockStoryService.checkAndTriggerEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          character: testCharacter,
          lastUserMessage: 'Активация события: Test Event',
          conversationLength: 1,
          timeSinceLastInteraction: 0,
        }),
      );
    });

    it('должен выбрасывать ошибку для несуществующего персонажа', async () => {
      mockCharacterRepository.findOne.mockResolvedValue(null);

      await expect(service.triggerEventForCharacter(999, 'Test Event')).rejects.toThrow(
        'Персонаж с ID 999 не найден',
      );
    });
  });
});
