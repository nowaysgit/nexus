import { createTest, createTestSuite, TestConfigType } from '../../lib/tester';
import { StoryService, RelationshipStage } from '../../src/character/services/story.service';
import { LogService } from '../../src/logging/log.service';
import { MockLogService, MockRollbarService } from '../../lib/tester/mocks';
import { CharacterService } from '../../src/character/services/character.service';
import { DialogService } from '../../src/dialog/services/dialog.service';
import {
  StoryEvent,
  EventType,
  EventStatus,
} from '../../src/character/entities/story-event.entity';
import {
  StoryPlan,
  StoryMilestone,
  TransformationType,
  MilestoneStatus,
} from '../../src/character/entities/story-plan.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

// Моки
const mockLogService = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn().mockReturnThis(),
};

const mockCharacterService = {
  findOne: jest.fn().mockResolvedValue({
    id: 1,
    name: 'Тестовый персонаж',
    personality: {},
  }),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
};

const mockDialogService = {
  getDialogHistory: jest.fn().mockResolvedValue([]),
  saveMessage: jest.fn(),
  getDialogContext: jest.fn().mockResolvedValue('Контекст диалога'),
};

const mockStoryEvent: StoryEvent = {
  id: 1,
  characterId: 1,
  type: EventType.RELATIONSHIP_MILESTONE,
  title: 'Тестовое событие',
  description: 'Описание тестового события',
  status: EventStatus.PENDING,
  triggers: {},
  effects: {},
  dialogOptions: [],
  character: null,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  triggeredAt: null,
  completedAt: null,
};

const mockStoryPlan: StoryPlan = {
  id: 1,
  characterId: 1,
  title: 'Тестовый план',
  description: 'Описание тестового плана',
  startDate: new Date('2024-01-01T00:00:00Z'),
  endDate: new Date('2024-12-31T23:59:59Z'),
  overallArc: {
    startingState: {},
    endingState: {},
    majorThemes: [],
    evolutionDirection: 'positive',
  },
  retrospectivePlanning: {
    preExistingTraits: {},
    formativeEvents: [],
    characterHistory: '',
    pastInfluences: [],
  },
  milestones: [],
  character: null,
  adaptabilitySettings: {
    coreEventsRigidity: 5,
    detailsFlexibility: 5,
    userInfluenceWeight: 5,
    emergentEventTolerance: 5,
  },
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const mockStoryMilestone: StoryMilestone = {
  id: 1,
  storyPlanId: 1,
  title: 'Тестовая веха',
  description: 'Описание тестовой вехи',
  transformationType: TransformationType.PERSONALITY_CHANGE,
  status: MilestoneStatus.PLANNED,
  plannedMonth: 6,
  plannedDay: 150,
  transformationDetails: {
    currentState: {},
    targetState: {},
    progressIndicators: [],
    prerequisiteEvents: [],
    transitionMethod: 'gradual',
  },
  causalConnections: {
    triggeringConditions: [],
    consequenceEvents: [],
    timelineConstraints: {},
  },
  rigidityLevel: 5,
  isKeyMilestone: false,
  characterId: 1,
  character: null,
  storyPlan: mockStoryPlan,
  achievedAt: null,
  actualResults: {},
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const mockStoryEventRepository = {
  create: jest.fn().mockReturnValue(mockStoryEvent),
  save: jest.fn().mockResolvedValue(mockStoryEvent),
  find: jest.fn().mockResolvedValue([mockStoryEvent]),
  findOne: jest.fn().mockResolvedValue(mockStoryEvent),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockStoryPlanRepository = {
  create: jest.fn().mockImplementation(data => ({ ...mockStoryPlan, ...data })),
  save: jest.fn().mockImplementation(data => Promise.resolve({ ...mockStoryPlan, ...data })),
  find: jest.fn().mockResolvedValue([mockStoryPlan]),
  findOne: jest.fn().mockResolvedValue(mockStoryPlan),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockStoryMilestoneRepository = {
  create: jest.fn().mockImplementation(data => ({ ...mockStoryMilestone, ...data })),
  save: jest.fn().mockImplementation(data => Promise.resolve({ ...mockStoryMilestone, ...data })),
  find: jest.fn().mockResolvedValue([mockStoryMilestone]),
  findOne: jest.fn().mockResolvedValue(mockStoryMilestone),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const testProviders = [
  StoryService,
  {
    provide: getRepositoryToken(StoryEvent),
    useValue: mockStoryEventRepository,
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
    provide: CharacterService,
    useValue: mockCharacterService,
  },
  {
    provide: DialogService,
    useValue: mockDialogService,
  },
  {
    provide: LogService,
    useValue: mockLogService,
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
];

createTestSuite('StoryService Tests', () => {
  let storyService: StoryService;

  beforeEach(() => {
    jest.clearAllMocks();
  });
  createTest(
    {
      name: 'должен создать экземпляр сервиса',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      expect(storyService).toBeDefined();
      expect(storyService).toBeInstanceOf(StoryService);
      expect(mockLogService.setContext).toHaveBeenCalledWith('StoryService');
    },
  );

  createTest(
    {
      name: 'должен создать сюжетное событие',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

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
    },
  );

  createTest(
    {
      name: 'должен найти ожидающие события',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

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
    },
  );

  createTest(
    {
      name: 'должен найти активированные события',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const characterId = 1;
      const events = await storyService.findTriggeredEvents(characterId);

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      expect(mockStoryEventRepository.find).toHaveBeenCalledWith({
        where: { characterId, status: EventStatus.TRIGGERED },
        order: { triggeredAt: 'DESC' },
      });
    },
  );

  createTest(
    {
      name: 'должен завершить событие',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const eventId = 1;
      const result = await storyService.completeEvent(eventId);

      expect(result).toBeDefined();
      expect(result.status).toBe(EventStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(mockStoryEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: eventId },
      });
      expect(mockStoryEventRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен пропустить событие',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const eventId = 1;
      const result = await storyService.skipEvent(eventId);

      expect(result).toBeDefined();
      expect(result.status).toBe(EventStatus.SKIPPED);
      expect(mockStoryEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: eventId },
      });
      expect(mockStoryEventRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обновить статус события',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

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
    },
  );

  createTest(
    {
      name: 'должен удалить событие',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const eventId = 1;
      await storyService.deleteEvent(eventId);

      expect(mockStoryEventRepository.delete).toHaveBeenCalledWith(eventId);
    },
  );

  createTest(
    {
      name: 'должен создать 12-месячный план',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const characterId = 1;
      const planData = {
        title: 'Годовой план развития',
        description: 'План эволюции персонажа на год',
      };

      const result = await storyService.createTwelveMonthPlan(characterId, planData);

      expect(result).toBeDefined();
      expect(result.characterId).toBe(characterId);
      expect(result.title).toBe(planData.title);
      expect(mockCharacterService.findOne).toHaveBeenCalledWith(characterId);
      expect(mockStoryPlanRepository.create).toHaveBeenCalled();
      expect(mockStoryPlanRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен создать веху',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const storyPlanId = 1;
      const milestoneData = {
        title: 'Новая веха',
        description: 'Описание новой вехи',
        transformationType: TransformationType.PERSONALITY_CHANGE,
      };

      const result = await storyService.createMilestone(storyPlanId, milestoneData);

      expect(result).toBeDefined();
      expect(result.storyPlanId).toBe(storyPlanId);
      expect(result.title).toBe(milestoneData.title);
      expect(result.status).toBe(MilestoneStatus.PLANNED);
      expect(mockStoryPlanRepository.findOne).toHaveBeenCalledWith({
        where: { id: storyPlanId },
      });
      expect(mockStoryMilestoneRepository.create).toHaveBeenCalled();
      expect(mockStoryMilestoneRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен получить план персонажа',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const characterId = 1;
      const result = await storyService.getCharacterPlan(characterId);

      expect(result).toBeDefined();
      expect(result.characterId).toBe(characterId);
      expect(mockStoryPlanRepository.findOne).toHaveBeenCalledWith({
        where: { characterId },
        relations: ['milestones'],
        order: { createdAt: 'DESC' },
      });
    },
  );

  createTest(
    {
      name: 'должен получить предстоящие вехи',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const characterId = 1;
      const daysAhead = 30;
      const result = await storyService.getUpcomingMilestones(characterId, daysAhead);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockStoryMilestoneRepository.find).toHaveBeenCalledWith({
        where: {
          characterId,
          status: MilestoneStatus.PLANNED,
        },
        order: { plannedDay: 'ASC' },
      });
    },
  );

  createTest(
    {
      name: 'должен активировать веху',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const milestoneId = 1;
      const result = await storyService.triggerMilestone(milestoneId);

      expect(result).toBeDefined();
      expect(result.status).toBe(MilestoneStatus.IN_PROGRESS);
      expect(result.achievedAt).toBeNull();
      expect(mockStoryMilestoneRepository.findOne).toHaveBeenCalledWith({
        where: { id: milestoneId },
      });
      expect(mockStoryMilestoneRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен завершить веху',
      configType: TestConfigType.BASIC,
      providers: testProviders,
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const milestoneId = 1;
      const actualResults = { achievement: 'completed', score: 100 };
      const result = await storyService.completeMilestone(milestoneId, actualResults);

      expect(result).toBeDefined();
      expect(result.status).toBe(MilestoneStatus.ACHIEVED);
      expect(result.achievedAt).toBeDefined();
      expect(result.actualResults).toEqual(actualResults);
      expect(mockStoryMilestoneRepository.findOne).toHaveBeenCalledWith({
        where: { id: milestoneId },
      });
      expect(mockStoryMilestoneRepository.save).toHaveBeenCalled();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при создании события для несуществующего персонажа',
      configType: TestConfigType.BASIC,
      providers: [
        StoryService,
        {
          provide: getRepositoryToken(StoryEvent),
          useValue: mockStoryEventRepository,
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
          provide: CharacterService,
          useValue: {
            ...mockCharacterService,
            findOne: jest.fn().mockRejectedValue(new Error('Character not found')),
          },
        },
        {
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
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
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const characterId = 999;
      const eventData = {
        type: EventType.RELATIONSHIP_MILESTONE,
        title: 'Событие для несуществующего персонажа',
      };

      const result = await storyService.createStoryEvent(characterId, eventData);

      expect(result).toBeNull();
    },
  );

  createTest(
    {
      name: 'должен обрабатывать ошибки при завершении несуществующего события',
      configType: TestConfigType.BASIC,
      providers: [
        StoryService,
        {
          provide: getRepositoryToken(StoryEvent),
          useValue: {
            ...mockStoryEventRepository,
            findOne: jest.fn().mockResolvedValue(null),
          },
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
          provide: CharacterService,
          useValue: mockCharacterService,
        },
        {
          provide: DialogService,
          useValue: mockDialogService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
      timeout: 5000,
    },
    async context => {
      storyService = context.get(StoryService) as StoryService;

      const eventId = 999;
      const result = await storyService.completeEvent(eventId);

      expect(result).toBeNull();
    },
  );
});
