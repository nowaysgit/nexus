import { StoryService, RelationshipStage } from '../../src/character/services/story.service';
import {
  StoryEvent,
  EventType,
  EventStatus,
} from '../../src/character/entities/story-event.entity';
import { CharacterService } from '../../src/character/services/character.service';
import { LogService } from '../../src/logging/log.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import { StoryPlan, StoryMilestone } from '../../src/character/entities/story-plan.entity';
import { TestModuleBuilder } from '../../lib/tester/utils/test-module-builder';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestingModule } from '@nestjs/testing';

// Создаем моки для зависимостей
const mockStoryEventRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn(),
  count: jest.fn(),
};

const mockCharacterService = {
  findOne: jest.fn(),
  updateCharacter: jest.fn(),
  getCharacterById: jest.fn(),
};

const mockLogService = {
  setContext: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

const mockStoryPlanRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
};

const mockStoryMilestoneRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
};

const mockDialogService = {
  createDialog: jest.fn(),
  getDialogById: jest.fn(),
  addMessage: jest.fn(),
};

describe('StoryService Tests', () => {
  let testingModule: TestingModule;
  let storyService: StoryService;

  beforeEach(async () => {
    // Очищаем моки перед каждым тестом
    jest.clearAllMocks();

    // Настраиваем возвращаемые значения для моков
    mockCharacterService.findOne.mockResolvedValue({
      id: 1,
      name: 'Test Character',
    });

    mockStoryEventRepository.create.mockImplementation(
      (data: any) => ({ id: 1, ...data }) as StoryEvent,
    );
    mockStoryEventRepository.save.mockImplementation((event: any) => Promise.resolve(event));
    mockStoryEventRepository.find.mockResolvedValue([
      { id: 1, status: EventStatus.PENDING, characterId: 1 },
    ]);
    mockStoryEventRepository.findOne.mockResolvedValue({
      id: 1,
      status: EventStatus.PENDING,
      characterId: 1,
    });

    const moduleBuilder = TestModuleBuilder.create()
      .withDatabase(false)
      .withProviders([
        StoryService,
        {
          provide: getRepositoryToken(StoryEvent),
          useValue: mockStoryEventRepository,
        },
        {
          provide: CharacterService,
          useValue: mockCharacterService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
        {
          provide: getRepositoryToken(StoryPlan),
          useValue: mockStoryPlanRepository,
        },
        {
          provide: getRepositoryToken(StoryMilestone),
          useValue: mockStoryMilestoneRepository,
        },
        {
          provide: DialogService,
          useValue: mockDialogService,
        },
      ]);

    testingModule = await moduleBuilder.compile();
    storyService = testingModule.get<StoryService>(StoryService);
  });

  afterEach(async () => {
    if (testingModule) {
      await testingModule.close();
    }
  });

  it('должен создать экземпляр сервиса', () => {
    expect(storyService).toBeDefined();
    expect(storyService).toBeInstanceOf(StoryService);
    expect(mockLogService.setContext).toHaveBeenCalledWith('StoryService');
  });

  it('должен создать сюжетное событие', async () => {
    const characterId = 1;
    const eventData = {
      type: EventType.RELATIONSHIP_MILESTONE,
      title: 'Новое событие',
      description: 'Описание нового события',
      triggers: { relationshipStage: RelationshipStage.FRIEND },
      effects: { affectionChange: 10 },
    };

    const result = await storyService.createStoryEvent(characterId, eventData);

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.characterId).toBe(characterId);
    expect(result.status).toBe(EventStatus.PENDING);
    expect(mockCharacterService.findOne).toHaveBeenCalledWith(characterId);
    expect(mockStoryEventRepository.create).toHaveBeenCalled();
    expect(mockStoryEventRepository.save).toHaveBeenCalled();
  });

  it('должен найти ожидающие события', async () => {
    const characterId = 1;
    const events = await storyService.findPendingEvents(characterId);

    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(EventStatus.PENDING);
    expect(mockStoryEventRepository.find).toHaveBeenCalledWith({
      where: { characterId, status: EventStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  });

  it('должен найти активированные события', async () => {
    const characterId = 1;
    const events = await storyService.findTriggeredEvents(characterId);

    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(mockStoryEventRepository.find).toHaveBeenCalledWith({
      where: { characterId, status: EventStatus.TRIGGERED },
      order: { triggeredAt: 'DESC' },
    });
  });

  it('должен завершить событие', async () => {
    // Настраиваем мок для возврата события, которое можно завершить
    mockStoryEventRepository.findOne.mockResolvedValue({
      id: 1,
      status: EventStatus.TRIGGERED,
      characterId: 1,
    });

    mockStoryEventRepository.save.mockImplementation((event: any) =>
      Promise.resolve({
        ...event,
        status: EventStatus.COMPLETED,
        completedAt: new Date(),
      }),
    );

    const eventId = 1;
    const result = await storyService.completeEvent(eventId);

    expect(result).toBeDefined();
    expect(result.status).toBe(EventStatus.COMPLETED);
    expect(result.completedAt).toBeDefined();
    expect(mockStoryEventRepository.findOne).toHaveBeenCalledWith({
      where: { id: eventId },
    });
    expect(mockStoryEventRepository.save).toHaveBeenCalled();
  });

  it('должен пропустить событие', async () => {
    // Настраиваем мок для возврата события, которое можно пропустить
    mockStoryEventRepository.save.mockImplementation((event: any) =>
      Promise.resolve({
        ...event,
        status: EventStatus.SKIPPED,
      }),
    );

    const eventId = 1;
    const result = await storyService.skipEvent(eventId);

    expect(result).toBeDefined();
    expect(result.status).toBe(EventStatus.SKIPPED);
    expect(mockStoryEventRepository.findOne).toHaveBeenCalledWith({
      where: { id: eventId },
    });
    expect(mockStoryEventRepository.save).toHaveBeenCalled();
  });

  it('должен обновить статус события', async () => {
    // Настраиваем мок для возврата обновленного события
    mockStoryEventRepository.save.mockImplementation((event: any) =>
      Promise.resolve({
        ...event,
        status: EventStatus.TRIGGERED,
        triggeredAt: new Date(),
      }),
    );

    const eventId = 1;
    const newStatus = EventStatus.TRIGGERED;
    const result = await storyService.updateEventStatus(eventId, newStatus);

    expect(result).toBeDefined();
    expect(result.status).toBe(newStatus);
    expect(result.triggeredAt).toBeDefined();
    expect(mockStoryEventRepository.findOne).toHaveBeenCalledWith({
      where: { id: eventId },
    });
    expect(mockStoryEventRepository.save).toHaveBeenCalled();
  });

  it('должен удалить событие', async () => {
    const eventId = 1;
    await storyService.deleteEvent(eventId);

    expect(mockStoryEventRepository.delete).toHaveBeenCalledWith(eventId);
  });
});
